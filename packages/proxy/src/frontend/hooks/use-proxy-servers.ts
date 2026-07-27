'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiCall, apiCallOrThrow, flash } from '@tentacrawl/ui';
import type { RunOutcome } from '@tentacrawl/core';

export const PROXY_EXTENSION_KEY = 'proxy/manual';

export interface ProxyEndpointItem {
  id: string;
  url: string;
  timesUsed: number;
  timesSucceeded: number;
  timesFailed: number;
  lastUsedAt?: string;
  lastFailedAt?: string;
  lastError?: string;
}

export interface ProxyServerItem {
  id: string;
  name: string;
  enabled: boolean;
  location?: string;
  username?: string;
  // the API never returns the password; it only reports whether one is set
  hasPassword: boolean;
  notes?: string;
  endpoints: ProxyEndpointItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ProxyServerListParams {
  name?: string;
  endpoint?: string;
  enabled?: 'true' | 'false';
  location?: string;
  usage?: 'used' | 'unused' | 'failing';
  limit?: number;
  offset?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface ProxyServerListResponse {
  data: ProxyServerItem[];
  total: number;
}

export interface ProxyUsageItem {
  id: string;
  serverId: string;
  endpointId: string;
  endpointUrl: string;
  taskId: string;
  taskType: string;
  correlationId?: string;
  outcome?: RunOutcome;
  error?: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
}

export interface SaveProxyServerInput {
  name: string;
  enabled: boolean;
  location?: string;
  username?: string;
  password?: string;
  notes?: string;
  endpoints: Array<{ id?: string; url: string }>;
}

export interface TestProxyEndpointInput {
  url: string;
  username?: string;
  password?: string;
  // present when testing an endpoint on an already-saved server; lets the
  // backend fall back to the stored password when this field is left blank
  serverId?: string;
}

export interface ProxyValidationDetails {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  org?: string;
  latencyMs: number;
}

export interface ProxyValidationResult {
  ok: boolean;
  error?: string;
  details?: ProxyValidationDetails;
}

export interface ProxyExtensionConfigValues {
  rotation: 'round-robin' | 'random';
  countBlockedAsFailure: boolean;
}

const DEFAULT_EXTENSION_CONFIG: ProxyExtensionConfigValues = {
  rotation: 'round-robin',
  countBlockedAsFailure: true,
};

export function useProxyServers(params: ProxyServerListParams = {}) {
  const qs = new URLSearchParams();
  if (params.name) qs.set('name', params.name);
  if (params.endpoint) qs.set('endpoint', params.endpoint);
  if (params.enabled) qs.set('enabled', params.enabled);
  if (params.location) qs.set('location', params.location);
  if (params.usage) qs.set('usage', params.usage);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  if (params.sort) qs.set('sort', params.sort);
  if (params.order) qs.set('order', params.order);

  const query = qs.toString();
  const url = query ? `/proxy/servers?${query}` : '/proxy/servers';

  return useQuery<ProxyServerListResponse>({
    queryKey: ['proxy-servers', params],
    queryFn: () => apiCallOrThrow<ProxyServerListResponse>(url),
  });
}

export function useProxyServerLocations() {
  return useQuery<string[]>({
    queryKey: ['proxy-server-locations'],
    queryFn: () => apiCallOrThrow<string[]>('/proxy/servers/locations'),
  });
}

export function useProxyServer(id: string) {
  return useQuery<ProxyServerItem>({
    queryKey: ['proxy-server', id],
    queryFn: () => apiCallOrThrow<ProxyServerItem>(`/proxy/servers/${id}`),
    enabled: !!id,
  });
}

export function useProxyServerUsage(id: string, limit = 25) {
  return useQuery<ProxyUsageItem[]>({
    queryKey: ['proxy-server-usage', id, limit],
    queryFn: () =>
      apiCallOrThrow<ProxyUsageItem[]>(`/proxy/servers/${id}/usage?limit=${limit}`),
    enabled: !!id,
  });
}

export function useCreateProxyServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveProxyServerInput) => {
      const result = await apiCall<{ id: string; name: string }>('/proxy/servers', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy-servers'] });
      flash('Proxy server created', 'success');
    },
    onError: (err: Error) => {
      flash(err.message, 'error');
    },
  });
}

export function useUpdateProxyServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: SaveProxyServerInput & { id: string }) => {
      const result = await apiCall<{ id: string; name: string }>(`/proxy/servers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data!;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proxy-servers'] });
      queryClient.invalidateQueries({ queryKey: ['proxy-server', variables.id] });
      flash('Proxy server updated', 'success');
    },
    onError: (err: Error) => {
      flash(err.message, 'error');
    },
  });
}

// no onSuccess/onError side effects — this reports pass/fail via the resolved
// result (ok/error/details), not an HTTP error, so callers render it inline
export function useTestProxyEndpoint() {
  return useMutation({
    mutationFn: (input: TestProxyEndpointInput) =>
      apiCallOrThrow<ProxyValidationResult>('/proxy/servers/test-endpoint', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export function useDeleteProxyServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiCall(`/proxy/servers/${id}`, { method: 'DELETE' });
      if (result.error) {
        throw new Error(result.error);
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy-servers'] });
      flash('Proxy server deleted', 'success');
    },
    onError: (err: Error) => {
      flash(err.message, 'error');
    },
  });
}

export function useProxyExtensionConfig() {
  return useQuery<ProxyExtensionConfigValues>({
    queryKey: ['proxy-extension-config'],
    queryFn: async () => {
      const config = await apiCallOrThrow<Partial<ProxyExtensionConfigValues>>(
        `/challengers/${encodeURIComponent(PROXY_EXTENSION_KEY)}/config`,
      );
      return { ...DEFAULT_EXTENSION_CONFIG, ...config };
    },
  });
}

export function useSaveProxyExtensionConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: ProxyExtensionConfigValues) => {
      const result = await apiCall(
        `/challengers/${encodeURIComponent(PROXY_EXTENSION_KEY)}/config`,
        { method: 'PUT', body: JSON.stringify({ config }) },
      );
      if (result.error) {
        throw new Error(result.error);
      }
      return config;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy-extension-config'] });
      flash('Extension settings saved', 'success');
    },
    onError: (err: Error) => {
      flash(err.message, 'error');
    },
  });
}
