import { Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/mongodb';
import { ChallengerRegistry, challengerExtensionKey } from '@tentacrawl/core';
import type {
  ChallengerActionDefinition,
  ChallengerCapability,
  ChallengerExtension,
  ChallengerHandlerOptions,
  ChallengerRegistrar,
} from '@tentacrawl/core';
import type {
  ChallengerDispatcher,
  ChallengerRunSeed,
  ChallengerRunSession,
} from '@tentacrawl/browser';
import { ChallengerConfigEntity, ChallengerRegistrationEntity } from '../data/entities';
import {
  ChallengerRunSessionImpl,
  type CollectedHandler,
  type CollectedStage,
  type RunEndSummary,
  type RunnableExtension,
} from './challenger-run-session';
import { ChallengerStateManager } from './challenger-state.manager';
import { ChallengerSignalBus } from './challenger-signal.bus';
import { ChallengerActionRegistryService } from './challenger-action.registry';

interface HandlerTable {
  handlers: CollectedHandler[];
  actions: ChallengerActionDefinition[];
}

class CollectingRegistrar implements ChallengerRegistrar {
  readonly handlers: CollectedHandler[] = [];
  readonly actions: ChallengerActionDefinition[] = [];
  private seq = 0;

  private add(
    stage: CollectedStage,
    handler: (ctx: never) => void | Promise<void>,
    options?: ChallengerHandlerOptions,
  ): void {
    this.handlers.push({ stage, handler, options: options ?? {}, seq: this.seq++ });
  }

  onBootstrapContext: ChallengerRegistrar['onBootstrapContext'] = (h, o) =>
    this.add('bootstrap-context', h, o);
  onCreatePage: ChallengerRegistrar['onCreatePage'] = (h, o) => this.add('create-page', h, o);
  beforeNavigation: ChallengerRegistrar['beforeNavigation'] = (h, o) =>
    this.add('before-navigation', h, o);
  afterNavigation: ChallengerRegistrar['afterNavigation'] = (h, o) =>
    this.add('after-navigation', h, o);
  beforeStep: ChallengerRegistrar['beforeStep'] = (h, o) => this.add('before-step', h, o);
  afterStep: ChallengerRegistrar['afterStep'] = (h, o) => this.add('after-step', h, o);
  onRequest: ChallengerRegistrar['onRequest'] = (h, o) => this.add('request', h, o);
  onResponse: ChallengerRegistrar['onResponse'] = (h, o) => this.add('response', h, o);
  onRedirect: ChallengerRegistrar['onRedirect'] = (h, o) => this.add('redirect', h, o);
  onSessionSnapshot: ChallengerRegistrar['onSessionSnapshot'] = (h, o) =>
    this.add('session-snapshot', h, o);
  onSignal: ChallengerRegistrar['onSignal'] = (h, o) => this.add('signal', h, o);
  onArtefactCollected: ChallengerRegistrar['onArtefactCollected'] = (h, o) =>
    this.add('artefact-collected', h, o);
  onDiscoveredLink: ChallengerRegistrar['onDiscoveredLink'] = (h, o) =>
    this.add('discovered-link', h, o);
  onRunOutcome: ChallengerRegistrar['onRunOutcome'] = (h, o) => this.add('run-outcome', h, o);
  interceptRequest: ChallengerRegistrar['interceptRequest'] = (h, o) => {
    if (o?.mode === 'observer') {
      throw new Error('interceptRequest handlers cannot be registered in observer mode');
    }
    this.add('route-request', h, o);
  };
  interceptResponse: ChallengerRegistrar['interceptResponse'] = (h, o) => {
    if (o?.mode === 'observer') {
      throw new Error('interceptResponse handlers cannot be registered in observer mode');
    }
    this.add('route-response', h, o);
  };

  registerAction(action: ChallengerActionDefinition): void {
    this.actions.push(action);
  }
}

// dropped unless the extension declares the matching capability
const INTERCEPT_STAGE_CAPABILITY: Record<string, ChallengerCapability> = {
  'route-request': 'request-intercept',
  'route-response': 'response-intercept',
};

@Injectable()
export class ChallengerDispatcherService
  implements ChallengerDispatcher, OnApplicationBootstrap
{
  private readonly logger = new Logger(ChallengerDispatcherService.name);
  private readonly tables = new Map<string, HandlerTable>();
  private allowedCapabilities?: Set<ChallengerCapability>;
  private configCacheTtlMs = 3_000;
  private configCache?: { at: number; map: Map<string, ChallengerConfigEntity> };

  constructor(
    private readonly registry: ChallengerRegistry,
    private readonly em: EntityManager,
    private readonly signalBus: ChallengerSignalBus,
    private readonly actionRegistry: ChallengerActionRegistryService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    this.allowedCapabilities = this.readCapabilityAllowlist();
    this.configCacheTtlMs = this.readConfigCacheTtl();
    for (const extension of this.registry.getExtensions()) {
      this.collect(extension);
    }
  }

  async beginRun(seed: ChallengerRunSeed): Promise<ChallengerRunSession> {
    const configMap = await this.loadConfigs();
    const stateManager = new ChallengerStateManager();
    const runnables: RunnableExtension[] = [];

    for (const extension of this.registry.getExtensions()) {
      const key = challengerExtensionKey(extension);
      const table = this.collect(extension);

      const configEntity = configMap.get(key);
      if (configEntity && !configEntity.enabled) {
        this.logger.debug(`Challenger ${key} disabled, skipping for run ${seed.taskId}`);
        continue;
      }
      if (!this.capabilitiesAllowed(extension)) {
        this.logger.warn(
          `Challenger ${key} declares non-allowed capabilities, skipping`,
        );
        continue;
      }

      let config: unknown = configEntity?.config;
      if (extension.configSchema) {
        const parsed = extension.configSchema.safeParse(configEntity?.config ?? {});
        if (parsed.success) {
          config = parsed.data;
        } else {
          // invalid config (e.g. after upgrade): fall back to defaults, skip only if those also fail
          const defaults = extension.configSchema.safeParse({});
          if (defaults.success) {
            config = defaults.data;
            this.publishConfigInvalid(key, seed, parsed.error.message, 'using-defaults');
            this.logger.warn(
              `Challenger ${key} config invalid, using defaults: ${parsed.error.message}`,
            );
          } else {
            this.publishConfigInvalid(key, seed, parsed.error.message, 'skipped');
            this.logger.warn(
              `Challenger ${key} config invalid and no usable defaults, skipping: ${parsed.error.message}`,
            );
            continue;
          }
        }
      }

      runnables.push({
        extension,
        key,
        handlers: table.handlers,
        actions: table.actions,
        config,
        state: stateManager.stateFor(key),
      });
    }

    return new ChallengerRunSessionImpl(
      seed,
      runnables,
      {
        persistSignal: (extensionKey, signal, runSeed) =>
          this.signalBus.publish(extensionKey, signal, runSeed),
        onEnd: (summary) => this.recordRunEnd(summary),
      },
      this.logger,
    );
  }

  private collect(extension: ChallengerExtension): HandlerTable {
    const key = challengerExtensionKey(extension);
    let table = this.tables.get(key);
    if (table) return table;

    const registrar = new CollectingRegistrar();
    try {
      extension.register?.(registrar);
      this.actionRegistry.registerCollected(registrar.actions);
    } catch (err) {
      this.logger.error(`Challenger ${key} register() failed: ${err}`);
      throw err;
    }

    let handlers = registrar.handlers;
    for (const [stage, capability] of Object.entries(INTERCEPT_STAGE_CAPABILITY)) {
      if (extension.capabilities.includes(capability)) continue;
      const dropped = handlers.filter((h) => h.stage === stage).length;
      if (dropped > 0) {
        this.logger.warn(
          `Challenger ${key} registered ${stage} handlers without the '${capability}' capability; skipping ${dropped} handler(s)`,
        );
        handlers = handlers.filter((h) => h.stage !== stage);
      }
    }

    table = { handlers, actions: registrar.actions };
    this.tables.set(key, table);
    this.logger.log(
      `Collected challenger ${key}: ${table.handlers.length} handler(s), ${table.actions.length} action(s)`,
    );
    return table;
  }

  private publishConfigInvalid(
    key: string,
    seed: ChallengerRunSeed,
    reason: string,
    action: 'using-defaults' | 'skipped',
  ): void {
    this.signalBus.publish(
      key,
      {
        signalType: 'challenger.config-invalid',
        severity: action === 'skipped' ? 'error' : 'warn',
        source: seed.source,
        annotations: { reason, action },
      },
      seed,
    );
  }

  // cached briefly so a page-crawl burst shares one config read (CHALLENGER_CONFIG_CACHE_TTL_MS, 0 = disabled)
  private async loadConfigs(): Promise<Map<string, ChallengerConfigEntity>> {
    const now = Date.now();
    if (
      this.configCacheTtlMs > 0 &&
      this.configCache &&
      now - this.configCache.at < this.configCacheTtlMs
    ) {
      return this.configCache.map;
    }
    try {
      const configs = await this.em.fork().find(ChallengerConfigEntity, {});
      const map = new Map(configs.map((c) => [c.id, c]));
      this.configCache = { at: now, map };
      return map;
    } catch (err) {
      this.logger.warn(`Failed to load challenger configs: ${err}`);
      return this.configCache?.map ?? new Map();
    }
  }

  private readConfigCacheTtl(): number {
    const raw = this.configService?.get<string>('CHALLENGER_CONFIG_CACHE_TTL_MS');
    const parsed = raw !== undefined ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 3_000;
  }

  private capabilitiesAllowed(extension: ChallengerExtension): boolean {
    if (!this.allowedCapabilities) return true;
    return extension.capabilities.every((c) => this.allowedCapabilities!.has(c));
  }

  private readCapabilityAllowlist(): Set<ChallengerCapability> | undefined {
    const raw = this.configService?.get<string>('CHALLENGER_ALLOWED_CAPABILITIES');
    if (!raw) return undefined;
    return new Set(
      raw
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean) as ChallengerCapability[],
    );
  }

  private async recordRunEnd(summary: RunEndSummary): Promise<void> {
    const { participants, handlerErrors } = summary;
    if (participants.length === 0) return;
    try {
      const em = this.em.fork();
      await em.nativeUpdate(
        ChallengerRegistrationEntity,
        { id: { $in: participants } },
        { lastRunAt: new Date() },
      );
      // lastError only for extensions that actually failed
      for (const [key, message] of handlerErrors) {
        await em.nativeUpdate(
          ChallengerRegistrationEntity,
          { id: key },
          { lastError: message },
        );
      }
    } catch (err) {
      this.logger.warn(`Failed to record challenger run end: ${err}`);
    }
  }
}
