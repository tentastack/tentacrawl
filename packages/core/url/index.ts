// Proxy re-export so that @tentacrawl/core/url resolves under
// moduleResolution:"node" (which cannot read package.json "exports").
export * from '../src/url';