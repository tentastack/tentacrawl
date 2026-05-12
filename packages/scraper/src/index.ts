import type { ModuleInfo } from '@tentacrawl/core';

export const metadata: ModuleInfo = {
  name: 'scraper',
  title: 'Scraper',
  version: '0.1.0',
  description: 'Single-page scraping with configurable artefact formats',
  navigation: {
    label: 'Page Scraper',
    icon: 'Target',
    path: '/scrape',
    order: 10,
  },
  routes: [
    { path: 'scrape', page: 'scrape-list', title: 'Scrapes' },
    { path: 'scrape/new', page: 'scrape-create', title: 'New Scrape' },
    { path: 'scrape/:id', page: 'scrape-detail', title: 'Scrape Detail' },
  ],
};

export { ScraperModule } from './scraper.module';

export {
  createScrapeDto,
  scrapeListItemSchema,
  scrapePayloadSchema,
  scrapeResultSchema,
  scrapeResponseSchema,
} from './data/schemas';
export type {
  CreateScrapeDto,
  ScrapeListItem,
  ScrapePayload,
  ScrapeResult,
  ScrapeResponse,
} from './data/schemas';

export { ScrapeEntity } from './data/entities';
