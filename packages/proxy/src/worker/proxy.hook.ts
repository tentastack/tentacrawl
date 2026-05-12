import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleExtensionRegistry } from '@tentacrawl/core';
import type { RunnerHook, RunHookContext } from '@tentacrawl/core';
import { ProxyManagerService } from './proxy-manager.service';

@Injectable()
export class ProxyRunnerHook implements RunnerHook, OnModuleInit {
  readonly moduleId = 'proxy';
  readonly priority = 10;

  private readonly logger = new Logger(ProxyRunnerHook.name);

  constructor(
    private readonly extensions: ModuleExtensionRegistry,
    private readonly proxyManager: ProxyManagerService,
  ) {}

  onModuleInit(): void {
    this.extensions.registerHook(this);
  }

  async beforeRun(ctx: RunHookContext): Promise<void> {
    const { networkPolicy } = ctx;

    if (networkPolicy.mode === 'managed' && 'poolId' in networkPolicy) {
      const assignment = await this.proxyManager.acquireProxy(ctx.taskId, networkPolicy.poolId);
      if (assignment) {
        ctx.proxy = {
          server: assignment.server,
          username: assignment.username,
          password: assignment.password,
          id: assignment.sessionId,
        };
        ctx.hookData.set('proxy:leaseId', assignment.leaseId);
        this.logger.log(
          `Proxy acquired: lease=${assignment.leaseId} pool=${networkPolicy.poolId} task=${ctx.taskId}`,
        );
      }
    } else if (networkPolicy.mode === 'static' && 'proxy' in networkPolicy) {
      ctx.proxy = {
        server: networkPolicy.proxy.server,
        username: networkPolicy.proxy.username,
        password: networkPolicy.proxy.password,
      };
    }
  }

  async afterRun(ctx: RunHookContext): Promise<void> {
    await this.releaseLease(ctx, 'completed');
  }

  async onError(ctx: RunHookContext): Promise<void> {
    await this.releaseLease(ctx, 'error');
  }

  private async releaseLease(ctx: RunHookContext, reason: 'completed' | 'error'): Promise<void> {
    const leaseId = ctx.hookData.get('proxy:leaseId') as string | undefined;
    if (leaseId) {
      await this.proxyManager.releaseProxy(leaseId, reason);
      ctx.hookData.delete('proxy:leaseId');
    }
  }
}
