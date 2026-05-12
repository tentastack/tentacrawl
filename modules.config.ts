export interface ModuleEntry {
  id: string;
  package: string;
}

export const enabledModules: ModuleEntry[] = [
  { id: 'admin', package: '@tentacrawl/admin' },
  { id: 'notification', package: '@tentacrawl/notification' },
  { id: 'proxy', package: '@tentacrawl/proxy' },
  { id: 'scraper', package: '@tentacrawl/scraper' },
  { id: 'crawler', package: '@tentacrawl/crawler' },
];
