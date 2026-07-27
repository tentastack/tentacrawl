'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Badge,
  Button,
  DataLoader,
  DataTable,
  EmptyState,
  FilterBar,
  Page,
  PageBody,
  PageHeader,
  getCountryOptions,
  timeAgo,
  useDebouncedValue,
  type DataTableSort,
} from '@tentacrawl/ui';
import { Network, Plus } from 'lucide-react';
import {
  useProxyServerLocations,
  useProxyServers,
  type ProxyServerItem,
} from '../../hooks/use-proxy-servers';
import { ExtensionSettingsDialog } from '../../components/extension-settings-dialog';

interface ServerStats {
  used: number;
  succeeded: number;
  failed: number;
  lastUsedAt?: string;
}

function aggregate(server: ProxyServerItem): ServerStats {
  return server.endpoints.reduce<ServerStats>(
    (acc, endpoint) => ({
      used: acc.used + endpoint.timesUsed,
      succeeded: acc.succeeded + endpoint.timesSucceeded,
      failed: acc.failed + endpoint.timesFailed,
      lastUsedAt:
        !acc.lastUsedAt || (endpoint.lastUsedAt && endpoint.lastUsedAt > acc.lastUsedAt)
          ? endpoint.lastUsedAt
          : acc.lastUsedAt,
    }),
    { used: 0, succeeded: 0, failed: 0 },
  );
}

function successRate(stats: ServerStats): string {
  const settled = stats.succeeded + stats.failed;
  if (settled === 0) return '-';
  return `${Math.round((stats.succeeded / settled) * 100)}%`;
}

function buildColumns(countryLabels: Map<string, string>): ColumnDef<ProxyServerItem>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Server',
      cell: ({ row }) => (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{row.original.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {row.original.endpoints.map((endpoint) => endpoint.url).join(', ')}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'enabled',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.enabled ? 'success' : 'secondary'} weight="brutal">
          {row.original.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      ),
    },
    {
      accessorKey: 'location',
      header: 'Location',
      cell: ({ row }) => {
        const { location } = row.original;
        if (!location) {
          return <span className="text-xs text-muted-foreground">-</span>;
        }
        return (
          <span className="text-sm text-foreground">
            {countryLabels.get(location) ?? location}
          </span>
        );
      },
    },
    {
      id: 'endpoints',
      header: 'Endpoints',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm text-foreground">{row.original.endpoints.length}</span>
      ),
    },
    {
      id: 'usage',
      header: 'Uses / Failures',
      enableSorting: false,
      cell: ({ row }) => {
        const stats = aggregate(row.original);
        return (
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">{stats.used} uses</p>
            <p className="text-xs text-muted-foreground">{stats.failed} failed</p>
          </div>
        );
      },
    },
    {
      id: 'successRate',
      header: 'Success Rate',
      enableSorting: false,
      cell: ({ row }) => {
        const stats = aggregate(row.original);
        const settled = stats.succeeded + stats.failed;
        if (settled === 0) {
          return <span className="text-sm text-muted-foreground">-</span>;
        }
        return <span className="text-sm text-foreground">{successRate(stats)}</span>;
      },
    },
    {
      id: 'lastUsed',
      header: 'Last Used',
      enableSorting: false,
      cell: ({ row }) => {
        const stats = aggregate(row.original);
        return (
          <span className="text-xs text-muted-foreground">
            {stats.lastUsedAt ? timeAgo(stats.lastUsedAt) : '-'}
          </span>
        );
      },
    },
  ];
}

export function ProxyServerListPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [enabled, setEnabled] = useState('');
  const [location, setLocation] = useState('');
  const [usage, setUsage] = useState('');
  const [sortState, setSortState] = useState<DataTableSort>({
    key: 'name',
    direction: 'asc',
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const debouncedName = useDebouncedValue(name, 300);
  const debouncedEndpoint = useDebouncedValue(endpoint, 300);

  const countryLabels = useMemo(
    () => new Map(getCountryOptions().map((option) => [option.value, option.label])),
    [],
  );
  // only countries actually assigned to a server show up as filter options
  const { data: usedLocations } = useProxyServerLocations();
  const locationOptions = useMemo(
    () =>
      (usedLocations ?? []).map((code) => ({
        label: countryLabels.get(code) ?? code,
        value: code,
      })),
    [usedLocations, countryLabels],
  );

  const { data, isLoading, error } = useProxyServers({
    name: debouncedName || undefined,
    endpoint: debouncedEndpoint || undefined,
    enabled: (enabled || undefined) as 'true' | 'false' | undefined,
    location: location || undefined,
    usage: (usage || undefined) as 'used' | 'unused' | 'failing' | undefined,
    limit: pageSize,
    offset: page * pageSize,
    sort: sortState.key,
    order: sortState.direction,
  });

  const servers = data?.data ?? [];
  const hasActiveFilters = Boolean(name || endpoint || enabled || location || usage);
  const columns = useMemo(() => buildColumns(countryLabels), [countryLabels]);

  const resetPage = () => setPage(0);

  return (
    <Page>
      <PageHeader
        title="Proxy Servers"
        description={
          data
            ? `${data.total} manually defined server${data.total === 1 ? '' : 's'} available to managed network policies.`
            : 'Manually defined proxy servers for scrape and crawl network policies'
        }
      >
        <div className="flex items-center gap-2">
          <ExtensionSettingsDialog />
          <Button onClick={() => router.push('/proxy/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Server
          </Button>
        </div>
      </PageHeader>
      <PageBody>
        <div className="space-y-3">
          <FilterBar
            filters={[
              {
                id: 'name',
                label: 'Name',
                type: 'text',
                placeholder: 'Filter by name',
              },
              {
                id: 'endpoint',
                label: 'Endpoint',
                type: 'text',
                placeholder: 'Filter by endpoint URL',
              },
              {
                id: 'enabled',
                label: 'Status',
                type: 'select',
                showAllOption: true,
                options: [
                  { label: 'Enabled', value: 'true' },
                  { label: 'Disabled', value: 'false' },
                ],
              },
              {
                id: 'location',
                label: 'Location',
                type: 'select',
                showAllOption: true,
                options: locationOptions,
              },
              {
                id: 'usage',
                label: 'Usage',
                type: 'select',
                showAllOption: true,
                options: [
                  { label: 'Used at least once', value: 'used' },
                  { label: 'Never used', value: 'unused' },
                  { label: 'Has failures', value: 'failing' },
                ],
              },
            ]}
            values={{ name, endpoint, enabled, location, usage }}
            onChange={(id, value) => {
              if (id === 'name') setName(value);
              if (id === 'endpoint') setEndpoint(value);
              if (id === 'enabled') setEnabled(value);
              if (id === 'location') setLocation(value);
              if (id === 'usage') setUsage(value);
              resetPage();
            }}
          />

          <DataLoader isLoading={false} error={error}>
            {!isLoading && !error && servers.length === 0 ? (
              <EmptyState
                icon={<Network className="h-10 w-10" />}
                title={hasActiveFilters ? 'No Matching Servers' : 'No Proxy Servers Yet'}
                description={
                  hasActiveFilters
                    ? 'No proxy servers match the current filters. Clear them or define a new server.'
                    : 'Define a proxy server with one or more endpoints to route managed-mode scrapes and crawls through it.'
                }
                action={
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {hasActiveFilters ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setName('');
                          setEndpoint('');
                          setEnabled('');
                          setLocation('');
                          setUsage('');
                          resetPage();
                        }}
                      >
                        Clear Filters
                      </Button>
                    ) : null}
                    <Button onClick={() => router.push('/proxy/new')}>
                      <Plus className="mr-2 h-4 w-4" />
                      New Server
                    </Button>
                  </div>
                }
                className="min-h-[280px] border-0 bg-transparent px-0 py-12 shadow-none"
              />
            ) : (
              <DataTable
                columns={columns}
                data={servers}
                sort={sortState}
                sortableColumns={{
                  name: 'name',
                  enabled: 'enabled',
                  location: 'location',
                }}
                onSortChange={(nextSort) => {
                  setSortState(nextSort);
                  resetPage();
                }}
                isLoading={isLoading}
                pagination={{ page, pageSize, total: data?.total ?? 0 }}
                onPaginationChange={setPage}
                onPageSizeChange={(nextPageSize) => {
                  setPageSize(nextPageSize);
                  resetPage();
                }}
                showPageSizeControl
                onRowClick={(row) => router.push(`/proxy/${row.id}`)}
              />
            )}
          </DataLoader>
        </div>
      </PageBody>
    </Page>
  );
}
