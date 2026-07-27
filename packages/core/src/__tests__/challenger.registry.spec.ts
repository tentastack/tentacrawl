import { z } from 'zod';
import { ChallengerRegistry } from '../extension/challenger.registry';
import type {
  ChallengerActionDefinition,
  ChallengerExtension,
} from '../extension/challenger-contract';

function makeExtension(overrides: Partial<ChallengerExtension> = {}): ChallengerExtension {
  return {
    moduleId: 'test',
    extensionId: 'ext',
    version: '1.0.0',
    capabilities: ['signal-analysis'],
    ...overrides,
  };
}

function makeAction(action: string): ChallengerActionDefinition {
  return {
    action,
    schema: z.object({ action: z.literal(action) }),
    execute: async () => ({}),
  };
}

describe('ChallengerRegistry', () => {
  let registry: ChallengerRegistry;

  beforeEach(() => {
    registry = new ChallengerRegistry();
  });

  it('starts empty', () => {
    expect(registry.getExtensions()).toEqual([]);
    expect(registry.getActions()).toEqual([]);
  });

  it('registers and retrieves an extension', () => {
    const ext = makeExtension();
    registry.registerExtension(ext);
    expect(registry.getExtensions()).toEqual([ext]);
    expect(registry.getExtension('test/ext')).toBe(ext);
  });

  it('rejects duplicate moduleId/extensionId', () => {
    registry.registerExtension(makeExtension());
    expect(() => registry.registerExtension(makeExtension())).toThrow(
      'already registered: test/ext',
    );
  });

  it('sorts extensions by priority ascending, stable on ties', () => {
    const late = makeExtension({ extensionId: 'late', priority: 200 });
    const earlyA = makeExtension({ extensionId: 'early-a', priority: 10 });
    const defaultA = makeExtension({ extensionId: 'default-a' });
    const defaultB = makeExtension({ extensionId: 'default-b' });

    registry.registerExtension(late);
    registry.registerExtension(defaultA);
    registry.registerExtension(earlyA);
    registry.registerExtension(defaultB);

    expect(registry.getExtensions().map((e) => e.extensionId)).toEqual([
      'early-a',
      'default-a',
      'default-b',
      'late',
    ]);
  });

  it('registers and resolves actions', () => {
    const def = makeAction('solveCaptcha');
    registry.registerAction(def);
    expect(registry.getAction('solveCaptcha')).toBe(def);
    expect(registry.getActions()).toEqual([def]);
  });

  it('rejects action name collisions', () => {
    registry.registerAction(makeAction('solveCaptcha'));
    expect(() => registry.registerAction(makeAction('solveCaptcha'))).toThrow(
      'collision: solveCaptcha',
    );
  });

  it('rejects action names reserved by the base DSL', () => {
    expect(() => registry.registerAction(makeAction('goto'))).toThrow(
      'reserved by the base DSL: goto',
    );
  });
});
