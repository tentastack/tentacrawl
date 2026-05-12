'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiCall, apiCallOrThrow, flash } from '@tentacrawl/ui';
import type {
  CreateScrapeDto,
  ScrapeListItem,
  ScrapeResponse,
} from '../../data/schemas';

interface ScrapeListParams {
  status?: string;
  url?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

interface ScrapeListResponse {
  data: ScrapeListItem[];
  total: number;
}

export function useScrapes(params: ScrapeListParams = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.url) qs.set('url', params.url);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  if (params.sort) qs.set('sort', params.sort);
  if (params.order) qs.set('order', params.order);

  const query = qs.toString();
  const url = query ? `/scrape?${query}` : '/scrape';

  return useQuery<ScrapeListResponse>({
    queryKey: ['scrapes', params],
    queryFn: () => apiCallOrThrow<ScrapeListResponse>(url),
  });
}

export function useScrape(id: string) {
  return useQuery<ScrapeResponse>({
    queryKey: ['scrape', id],
    queryFn: () => apiCallOrThrow<ScrapeResponse>(`/scrape/${id}`),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === 'COMPLETED' || data.status === 'FAILED')) {
        return false;
      }
      return 2000;
    },
  });
}

export function useCreateScrape() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateScrapeDto) => {
      const result = await apiCall<ScrapeResponse>('/scrape', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrapes'] });
      flash('Scrape created', 'success');
    },
    onError: (err: Error) => {
      flash(err.message, 'error');
    },
  });
}
