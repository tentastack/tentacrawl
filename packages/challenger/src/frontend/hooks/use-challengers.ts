'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiCall, apiCallOrThrow, flash } from '@tentacrawl/ui';
import type { ChallengerListItem, ChallengerSignalItem } from '../../data/schemas';

export function useChallengers() {
  return useQuery<ChallengerListItem[]>({
    queryKey: ['challengers'],
    queryFn: () => apiCallOrThrow<ChallengerListItem[]>('/challengers'),
  });
}

export function useChallenger(id: string) {
  return useQuery<ChallengerListItem>({
    queryKey: ['challenger', id],
    queryFn: () =>
      apiCallOrThrow<ChallengerListItem>(`/challengers/${encodeURIComponent(id)}`),
    enabled: !!id,
  });
}

export function useChallengerSignals(id: string, limit = 50) {
  return useQuery<ChallengerSignalItem[]>({
    queryKey: ['challenger-signals', id, limit],
    queryFn: () =>
      apiCallOrThrow<ChallengerSignalItem[]>(
        `/challengers/${encodeURIComponent(id)}/signals?limit=${limit}`,
      ),
    enabled: !!id,
  });
}

export function useChallengerConfig(id: string) {
  return useQuery<Record<string, unknown>>({
    queryKey: ['challenger-config', id],
    queryFn: () =>
      apiCallOrThrow<Record<string, unknown>>(
        `/challengers/${encodeURIComponent(id)}/config`,
      ),
    enabled: !!id,
  });
}

export function useSetChallengerEnabled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const result = await apiCall(`/challengers/${encodeURIComponent(id)}/enabled`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
      if (result.error) {
        throw new Error(result.error);
      }
      return { id, enabled };
    },
    onSuccess: ({ id, enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['challengers'] });
      queryClient.invalidateQueries({ queryKey: ['challenger', id] });
      flash(`Extension ${enabled ? 'enabled' : 'disabled'}`, 'success');
    },
    onError: (err: Error) => {
      flash(err.message, 'error');
    },
  });
}

export function usePurgeChallenger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiCall(`/challengers/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (result.error) {
        throw new Error(result.error);
      }
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challengers'] });
      flash('Extension purged', 'success');
    },
    onError: (err: Error) => {
      flash(err.message, 'error');
    },
  });
}

export function useSetChallengerConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, config }: { id: string; config: Record<string, unknown> }) => {
      const result = await apiCall(`/challengers/${encodeURIComponent(id)}/config`, {
        method: 'PUT',
        body: JSON.stringify({ config }),
      });
      if (result.error) {
        throw new Error(result.error);
      }
      return { id };
    },
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: ['challenger-config', id] });
      flash('Configuration saved', 'success');
    },
    onError: (err: Error) => {
      flash(err.message, 'error');
    },
  });
}
