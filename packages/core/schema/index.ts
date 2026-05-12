// Proxy re-export so that @tentacrawl/core/schema resolves under
// moduleResolution:"node" (which cannot read package.json "exports").
export * from '../src/schema';
