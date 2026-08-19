export interface ModuleEntry {
  id: string;
  package: string;
}

// A module's `package` is either an in-workspace package under packages/<name>
// or an installed dependency; `pnpm generate` resolves both the same way.
// Install an external module with `pnpm add -w <package>` before adding it
// here. Run `pnpm generate` after changing this list.
// See https://docs.tentacrawl.com/architecture/module-system
export const enabledModules: ModuleEntry[] = [
  // Foundation
  { id: 'admin', package: '@tentacrawl/admin' },
  { id: 'challenger', package: '@tentacrawl/challenger' },
  { id: 'notification', package: '@tentacrawl/notification' },

  // Features
  { id: 'crawler', package: '@tentacrawl/crawler' },
  { id: 'scraper', package: '@tentacrawl/scraper' },
];
