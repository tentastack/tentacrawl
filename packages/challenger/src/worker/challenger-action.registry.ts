import { Injectable } from '@nestjs/common';
import { ChallengerRegistry } from '@tentacrawl/core';
import type { ChallengerActionDefinition } from '@tentacrawl/core';

@Injectable()
export class ChallengerActionRegistryService {
  constructor(private readonly registry: ChallengerRegistry) {}

  registerCollected(defs: ChallengerActionDefinition[]): void {
    for (const def of defs) {
      this.registry.registerAction(def);
    }
  }

  getActions(): ChallengerActionDefinition[] {
    return this.registry.getActions();
  }

  getAction(name: string): ChallengerActionDefinition | undefined {
    return this.registry.getAction(name);
  }
}
