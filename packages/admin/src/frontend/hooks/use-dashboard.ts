'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiCallOrThrow, queryWithTimeout } from '@tentacrawl/ui';
import type { ActivityLogListResponse, DashboardOverview, WorkerSummary } from '../../data/schemas';

interface DashboardActivityParams {
  limit?: number;
  offset?: number;
}

export function useDashboardOverview() {
  return useQuery<DashboardOverview>({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => queryWithTimeout(apiCallOrThrow<DashboardOverview>('/dashboard/overview'), 'Dashboard overview'),
    refetchInterval: 5000,
    retry: 1,
  });
}

export function useDashboardWorkers() {
  return useQuery<WorkerSummary[]>({
    queryKey: ['dashboard', 'workers'],
    queryFn: () => queryWithTimeout(apiCallOrThrow<WorkerSummary[]>('/dashboard/workers'), 'Dashboard workers'),
    refetchInterval: 10_000,
    retry: 1,
  });
}

function getDashboardActivityUrl(limit?: number, offset?: number) {
  const qs = new URLSearchParams();
  if (limit) qs.set('limit', String(limit));
  if (offset) qs.set('offset', String(offset));

  const query = qs.toString();
  return query ? `/dashboard/activity?${query}` : '/dashboard/activity';
}

export function useDashboardActivity(params: DashboardActivityParams = {}) {
  return useInfiniteQuery<ActivityLogListResponse, Error>({
    queryKey: ['dashboard', 'activity', params.limit ?? null],
    initialPageParam: params.offset ?? 0,
    queryFn: ({ pageParam }) => {
      const offset = typeof pageParam === 'number' ? pageParam : 0;
      const url = getDashboardActivityUrl(params.limit, offset);
      return queryWithTimeout(apiCallOrThrow<ActivityLogListResponse>(url), 'Dashboard activity');
    },
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce((total, page) => total + page.data.length, 0);
      return loadedCount < lastPage.total ? loadedCount : undefined;
    },
    refetchInterval: 5000,
    placeholderData: (previousData) => previousData,
    retry: 1,
  });
}
