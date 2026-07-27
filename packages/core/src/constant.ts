export const SCRAPE_QUEUE = 'scrape-jobs';
export const SCRAPE_QUEUE_CONCURRENCY = 1;

export const SCRAPE_QUEUE_DEFAULT_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
};

export const CRAWL_ORCHESTRATOR_QUEUE = 'crawl-orchestrator-jobs';
export const CRAWL_PAGE_QUEUE = 'crawl-page-jobs';
export const CRAWL_ORCHESTRATOR_QUEUE_CONCURRENCY = 1;
export const CRAWL_PAGE_QUEUE_CONCURRENCY = 4;

export const CRAWL_ORCHESTRATOR_QUEUE_DEFAULT_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
};

export const CRAWL_PAGE_QUEUE_DEFAULT_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
};

export const DEFAULT_TIMEOUT = 30_000;
export const DEFAULT_LOCALE = 'en-US';
export const DEFAULT_TIMEZONE = 'America/New_York';
export const DEFAULT_WAIT_FOR = 'domcontentloaded';

export const CRAWL_DEFAULT_MAX_DEPTH = 2;
export const CRAWL_DEFAULT_MAX_PAGES = 50;

export const CHALLENGER_DISPATCHER = Symbol('CHALLENGER_DISPATCHER');
