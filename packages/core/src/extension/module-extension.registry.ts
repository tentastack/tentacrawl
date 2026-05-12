import { Injectable, Logger } from '@nestjs/common';
import type { RunnerHook } from './runner-hook';
import type { DslExtension } from './dsl-extension';

@Injectable()
export class ModuleExtensionRegistry {
  private readonly logger = new Logger(ModuleExtensionRegistry.name);
  private readonly hooks: RunnerHook[] = [];
  private readonly dslExtensions: DslExtension[] = [];
  private hooksSorted = false;

  registerHook(hook: RunnerHook): void {
    this.hooks.push(hook);
    this.hooksSorted = false;
    this.logger.log(`Registered runner hook: ${hook.moduleId} (priority=${hook.priority ?? 100})`);
  }

  getHooks(): RunnerHook[] {
    if (!this.hooksSorted) {
      this.hooks.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
      this.hooksSorted = true;
    }
    return this.hooks;
  }

  registerDsl(ext: DslExtension): void {
    this.dslExtensions.push(ext);
    this.logger.log(`Registered DSL extension: ${ext.moduleId}`);
  }

  getDslExtensions(): DslExtension[] {
    return this.dslExtensions;
  }
}
