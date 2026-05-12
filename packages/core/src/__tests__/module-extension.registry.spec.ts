import { ModuleExtensionRegistry } from '../extension/module-extension.registry';
import type { RunnerHook } from '../extension/runner-hook';
import type { DslExtension } from '../extension/dsl-extension';

describe('ModuleExtensionRegistry', () => {
  let registry: ModuleExtensionRegistry;

  beforeEach(() => {
    registry = new ModuleExtensionRegistry();
  });

  describe('hooks', () => {
    it('returns empty array when no hooks registered', () => {
      expect(registry.getHooks()).toEqual([]);
    });

    it('registers and retrieves hooks', () => {
      const hook: RunnerHook = { moduleId: 'test', priority: 10 };
      registry.registerHook(hook);
      expect(registry.getHooks()).toEqual([hook]);
    });

    it('sorts hooks by ascending priority', () => {
      const hookA: RunnerHook = { moduleId: 'a', priority: 50 };
      const hookB: RunnerHook = { moduleId: 'b', priority: 10 };
      const hookC: RunnerHook = { moduleId: 'c', priority: 30 };

      registry.registerHook(hookA);
      registry.registerHook(hookB);
      registry.registerHook(hookC);

      const sorted = registry.getHooks();
      expect(sorted.map((h) => h.moduleId)).toEqual(['b', 'c', 'a']);
    });

    it('defaults priority to 100 when not specified', () => {
      const hookLow: RunnerHook = { moduleId: 'low', priority: 10 };
      const hookDefault: RunnerHook = { moduleId: 'default' };

      registry.registerHook(hookDefault);
      registry.registerHook(hookLow);

      const sorted = registry.getHooks();
      expect(sorted.map((h) => h.moduleId)).toEqual(['low', 'default']);
    });

    it('re-sorts when new hooks are added after getHooks()', () => {
      const hookA: RunnerHook = { moduleId: 'a', priority: 50 };
      registry.registerHook(hookA);
      registry.getHooks();

      const hookB: RunnerHook = { moduleId: 'b', priority: 5 };
      registry.registerHook(hookB);

      expect(registry.getHooks()[0].moduleId).toBe('b');
    });
  });

  describe('DSL extensions', () => {
    it('returns empty array when none registered', () => {
      expect(registry.getDslExtensions()).toEqual([]);
    });

    it('registers and retrieves DSL extensions', () => {
      const ext: DslExtension = { moduleId: 'auth', extendStepSchema: () => ({}) as any };
      registry.registerDsl(ext);
      expect(registry.getDslExtensions()).toEqual([ext]);
    });
  });
});
