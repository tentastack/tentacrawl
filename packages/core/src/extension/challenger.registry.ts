import { Injectable, Logger } from '@nestjs/common';
import { BASE_DSL_ACTION_NAMES } from '../dsl-actions';
import {
  challengerExtensionKey,
  type ChallengerActionDefinition,
  type ChallengerExtension,
} from './challenger-contract';

// shared with dsl's DSL_ACTIONS so a challenger action can never shadow a base action
const RESERVED_ACTION_NAMES = new Set<string>(BASE_DSL_ACTION_NAMES);

@Injectable()
export class ChallengerRegistry {
  private readonly logger = new Logger(ChallengerRegistry.name);
  private readonly extensions = new Map<string, ChallengerExtension>();
  private readonly actions = new Map<string, ChallengerActionDefinition>();
  private registrationCounter = 0;
  private readonly registrationOrder = new Map<string, number>();

  registerExtension(ext: ChallengerExtension): void {
    const key = challengerExtensionKey(ext);
    if (this.extensions.has(key)) {
      throw new Error(`Challenger extension already registered: ${key}`);
    }
    this.extensions.set(key, ext);
    this.registrationOrder.set(key, this.registrationCounter++);
    this.logger.log(
      `Registered challenger extension: ${key} v${ext.version} (priority=${ext.priority ?? 100})`,
    );
  }

  getExtensions(): ChallengerExtension[] {
    return [...this.extensions.values()].sort((a, b) => {
      const byPriority = (a.priority ?? 100) - (b.priority ?? 100);
      if (byPriority !== 0) return byPriority;
      const orderA = this.registrationOrder.get(challengerExtensionKey(a)) ?? 0;
      const orderB = this.registrationOrder.get(challengerExtensionKey(b)) ?? 0;
      return orderA - orderB;
    });
  }

  getExtension(key: string): ChallengerExtension | undefined {
    return this.extensions.get(key);
  }

  registerAction(def: ChallengerActionDefinition): void {
    if (RESERVED_ACTION_NAMES.has(def.action)) {
      throw new Error(`Challenger action name is reserved by the base DSL: ${def.action}`);
    }
    if (this.actions.has(def.action)) {
      throw new Error(`Challenger action name collision: ${def.action}`);
    }
    this.actions.set(def.action, def);
    this.logger.log(`Registered challenger action: ${def.action}`);
  }

  getActions(): ChallengerActionDefinition[] {
    return [...this.actions.values()];
  }

  getAction(name: string): ChallengerActionDefinition | undefined {
    return this.actions.get(name);
  }
}
