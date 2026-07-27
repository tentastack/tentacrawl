// Proxy re-export so that @tentacrawl/core/logger resolves under
// moduleResolution:"node" (which cannot read package.json "exports").
export * from '../src/logger';
