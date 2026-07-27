import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChallengerRegistry, challengerExtensionKey } from '@tentacrawl/core';
import type {
  ChallengerBootstrapContext,
  ChallengerCapability,
  ChallengerExtension,
  ChallengerRegistrar,
  ChallengerRunOutcomeContext,
  ChallengerRuntimeContext,
  ChallengerSelectionDescriptor,
} from '@tentacrawl/core';
import { proxyExtensionConfigSchema, type ProxyExtensionConfig } from '../data/schemas';
import { ProxyManagerService } from './proxy-manager.service';

const USAGE_STATE_KEY = 'proxy:usageId';

// reference ChallengerExtension; see docs/proxy-module-spec.md
@Injectable()
export class ProxyChallengerExtension implements ChallengerExtension, OnModuleInit {
  readonly moduleId = 'proxy';
  readonly extensionId = 'manual';
  readonly version = '0.2.0';
  readonly priority = 10;
  readonly capabilities: ChallengerCapability[] = ['proxy'];
  readonly configSchema = proxyExtensionConfigSchema;
  readonly selection: ChallengerSelectionDescriptor = {
    capability: 'proxy',
    optionsPath: '/proxy/servers/options',
    autoLabel: 'Auto (any enabled server)',
  };

  private readonly logger = new Logger(ProxyChallengerExtension.name);

  constructor(
    private readonly registry: ChallengerRegistry,
    private readonly proxyManager: ProxyManagerService,
  ) {}

  onModuleInit(): void {
    this.registry.registerExtension(this);
  }

  register(registrar: ChallengerRegistrar): void {
    registrar.onBootstrapContext(
      (ctx) => this.selectProxy(ctx),
      { mode: 'mutating', priority: 10 },
    );
    registrar.onRunOutcome(
      (ctx) => this.recordOutcome(ctx),
      { mode: 'observer' },
    );
  }

  // covers runs that crash before the run-outcome stage
  async onError(ctx: ChallengerRuntimeContext, error: Error): Promise<void> {
    await this.finalize(ctx, 'ERROR', error.message);
  }

  private async selectProxy(ctx: ChallengerBootstrapContext): Promise<void> {
    const { networkPolicy } = ctx;

    if (networkPolicy.mode === 'static') {
      await ctx.helpers.setProxyCandidate({
        server: networkPolicy.proxy.server,
        username: networkPolicy.proxy.username,
        password: networkPolicy.proxy.password,
      });
      return;
    }

    if (networkPolicy.mode !== 'managed') return;
    if (networkPolicy.extension !== challengerExtensionKey(this)) return; // another extension owns this run

    const config = this.config(ctx);
    const assignment = await this.proxyManager.acquire({
      taskId: ctx.taskId,
      taskType: ctx.taskType,
      correlationId: ctx.correlationId,
      serverId: networkPolicy.serverId,
      rotation: config.rotation,
    });

    if (!assignment) {
      await ctx.helpers.emitSignal({
        signalType: 'proxy.no-server-available',
        severity: 'warn',
        annotations: { serverId: networkPolicy.serverId ?? 'auto' },
      });
      return;
    }

    await ctx.helpers.setProxyCandidate({
      server: assignment.server,
      username: assignment.username,
      password: assignment.password,
      id: assignment.endpointId,
    });
    ctx.state.set(USAGE_STATE_KEY, assignment.usageId);
    this.logger.log(
      `Proxy selected: usage=${assignment.usageId} task=${ctx.taskId}`,
    );
  }

  private async recordOutcome(ctx: ChallengerRunOutcomeContext): Promise<void> {
    const recorded = await this.finalize(
      ctx,
      ctx.outcome,
      ctx.reason ?? ctx.error?.message,
    );
    if (!recorded) return;

    const config = this.config(ctx);
    const failed =
      ctx.outcome === 'ERROR' ||
      (ctx.outcome === 'BLOCKED' && config.countBlockedAsFailure);
    if (failed) {
      await ctx.helpers.emitSignal({
        signalType: 'proxy.endpoint-failed',
        severity: 'warn',
        annotations: { outcome: ctx.outcome },
      });
    }
  }

  private async finalize(
    ctx: ChallengerRuntimeContext,
    outcome: ChallengerRunOutcomeContext['outcome'],
    error?: string,
  ): Promise<boolean> {
    const usageId = ctx.state.get(USAGE_STATE_KEY) as string | undefined;
    if (!usageId) return false;
    ctx.state.delete(USAGE_STATE_KEY);

    await this.proxyManager.recordOutcome(usageId, outcome, {
      error,
      countBlockedAsFailure: this.config(ctx).countBlockedAsFailure,
    });
    return true;
  }

  // defensive: also covers direct invocations that skip the dispatcher's validation
  private config(ctx: ChallengerRuntimeContext): ProxyExtensionConfig {
    const parsed = proxyExtensionConfigSchema.safeParse(ctx.config ?? {});
    return parsed.success ? parsed.data : proxyExtensionConfigSchema.parse({});
  }
}
