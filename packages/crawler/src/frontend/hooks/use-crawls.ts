'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiCall, apiCallOrThrow, flash } from '@tentacrawl/ui';
import type {
  CreateCrawlDto,
  CrawlPageListResponse,
  CrawlPageResponse,
  CrawlResponse,
} from '../../data/schemas';

const ACTIVE_CRAWL_STATUSES = new Set(['PENDING', 'PROCESSING']);
const ACTIVE_PAGE_STATUSES = new Set(['PENDING', 'PROCESSING']);

interface CrawlListParams {
  status?: string;
  url?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

interface CrawlListResponse {
  data: CrawlResponse[];
  total: number;
}

interface CrawlPageListParams {
  status?: string;
  url?: string;
  limit?: number;
  offset?: number;
}

function normalizeListResponse<T>(value: unknown): { data: T[]; total: number } {
  if (Array.isArray(value)) {
    return {
      data: value as T[],
      total: value.length,
    };
  }

  if (
    value
    && typeof value === 'object'
    && 'data' in value
    && Array.isArray((value as { data?: unknown }).data)
  ) {
    const response = value as { data: T[]; total?: unknown };
    return {
      data: response.data,
      total: typeof response.total === 'number' ? response.total : response.data.length,
    };
  }

  return {
    data: [],
    total: 0,
  };
}

export function useCrawls(params: CrawlListParams = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.url) qs.set('url', params.url);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  if (params.sort) qs.set('sort', params.sort);
  if (params.order) qs.set('order', params.order);

  const query = qs.toString();
  const url = query ? `/crawl?${query}` : '/crawl';

  return useQuery<CrawlListResponse>({
    queryKey: ['crawls', params],
    queryFn: async () => normalizeListResponse<CrawlResponse>(await apiCallOrThrow<unknown>(url)),
    refetchInterval: (query) => {
      const data = normalizeListResponse<CrawlResponse>(query.state.data);
      if (data.data.some((crawl) => ACTIVE_CRAWL_STATUSES.has(crawl.status))) {
        return 5000;
      }
      return false;
    },
  });
}

export function useCrawl(id: string) {
  return useQuery<CrawlResponse>({
    queryKey: ['crawl', id],
    queryFn: () => apiCallOrThrow<CrawlResponse>(`/crawl/${id}`),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || ACTIVE_CRAWL_STATUSES.has(data.status)) {
        return 3000;
      }
      return false;
    },
  });
}

export function useCrawlPages(crawlId: string, params: CrawlPageListParams = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.url) qs.set('url', params.url);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));

  const query = qs.toString();
  const url = query ? `/crawl/${crawlId}/pages?${query}` : `/crawl/${crawlId}/pages`;

  return useQuery<CrawlPageListResponse>({
    queryKey: ['crawl-pages', crawlId, params],
    queryFn: async () => normalizeListResponse(await apiCallOrThrow<unknown>(url)),
    enabled: Boolean(crawlId),
    refetchInterval: (query) => {
      const data = normalizeListResponse<CrawlPageListResponse['data'][number]>(query.state.data);
      if (data.data.some((page) => ACTIVE_PAGE_STATUSES.has(page.status))) {
        return 3000;
      }
      return false;
    },
  });
}

export function useCrawlPage(crawlId: string, pageId: string | null) {
  return useQuery<CrawlPageResponse>({
    queryKey: ['crawl-page', crawlId, pageId],
    queryFn: () => apiCallOrThrow<CrawlPageResponse>(`/crawl/${crawlId}/pages/${pageId}`),
    enabled: Boolean(crawlId && pageId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || ACTIVE_PAGE_STATUSES.has(data.status)) {
        return 3000;
      }
      return false;
    },
  });
}

export function useCreateCrawl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateCrawlDto) => {
      const result = await apiCall<CrawlResponse>('/crawl', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crawls'] });
      flash('Crawl queued', 'success');
    },
    onError: (err: Error) => {
      flash(err.message, 'error');
    },
  });
}

export function useCancelCrawl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiCall<CrawlResponse>(`/crawl/${id}`, {
        method: 'DELETE',
      });
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data!;
    },
    onSuccess: (crawl) => {
      queryClient.invalidateQueries({ queryKey: ['crawls'] });
      queryClient.invalidateQueries({ queryKey: ['crawl', crawl.id] });
      queryClient.invalidateQueries({ queryKey: ['crawl-pages', crawl.id] });
      flash('Crawl cancelled', 'success');
    },
    onError: (err: Error) => {
      flash(err.message, 'error');
    },
  });
}