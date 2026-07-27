export interface ModuleEntry {
  id: string;
  package: string;
}

// Run `pnpm generate` after changing this list.
export const enabledModules: ModuleEntry[] = [
  // Foundation
  { id: 'admin', package: '@tentacrawl/admin' },
  { id: 'challenger', package: '@tentacrawl/challenger' },
  { id: 'notification', package: '@tentacrawl/notification' },

  // Features
  { id: 'crawler', package: '@tentacrawl/crawler' },
  { id: 'scraper', package: '@tentacrawl/scraper' },

  // Optional
  { id: 'proxy', package: '@tentacrawl/proxy' },
];
