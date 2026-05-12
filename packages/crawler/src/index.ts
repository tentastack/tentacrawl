import type { ModuleInfo } from '@tentacrawl/core';

export const metadata: ModuleInfo = {
  name: 'crawler',
  title: 'Crawler',
  version: '0.1.0',
  description: 'Multi-page web crawler with depth/breadth control and URL filtering',
  navigation: {
    label: 'Website Crawler',
    icon: 'Radar',
    path: '/crawl',
    order: 20,
  },
  routes: [
    { path: 'crawl', page: 'crawl-list', title: 'Crawls' },
    { path: 'crawl/new', page: 'crawl-create', title: 'New Crawl' },
    { path: 'crawl/:id', page: 'crawl-detail', title: 'Crawl Detail' },
  ],
};

export { CrawlerModule } from './crawler.module';

export {
  createCrawlDto,
  crawlOrchestratorPayloadSchema,
  crawlPageListResponseSchema,
  crawlPageListItemSchema,
  crawlPagePayloadSchema,
  crawlPageResultSchema,
  crawlResponseSchema,
  crawlPageResponseSchema,
} from './data/schemas';
export type {
  CreateCrawlDto,
  CrawlOrchestratorPayload,
  CrawlPageListResponse,
  CrawlPageListItem,
  CrawlPagePayload,
  CrawlPageResult,
  CrawlResponse,
  CrawlPageResponse,
} from './data/schemas';

export { CrawlEntity, CrawlPageEntity } from './data/entities';
