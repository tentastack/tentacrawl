'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Button,
  computeDuration,
  DataLoader,
  DataTable,
  EmptyState,
  FilterBar,
  formatDurationExact,
  Page,
  PageBody,
  PageHeader,
  type DataTableSort,
  useDebouncedValue,
} from '@tentacrawl/ui';
import { extractUrlHostname } from '@tentacrawl/core/url';
import { ExternalLink, FileSearch, Plus } from 'lucide-react';
import { useScrapes } from '../../hooks/use-scrapes';
import { ScrapeStatusBadge } from '../../components/scrape-status-badge';
import type { ScrapeListItem, TaskStatus } from '../../../data/schemas';

function formatDateTime(value?: string) {
  if (!value) {
    return 'In progress';
  }

  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

const columns: ColumnDef<ScrapeListItem>[] = [
  {
    accessorKey: 'url',
    header: 'URL',
    cell: ({ row }) => {
      const url = row.original.url;

      return (
        <div className="flex max-w-[430px] items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-semibold text-foreground">{extractUrlHostname(url)}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{url}</p>
          </div>
          <a href={url} target="_blank" rel="noopener noreferrer" className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-brand">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <ScrapeStatusBadge status={row.original.status as TaskStatus} />,
  },
  {
    accessorKey: 'createdAt',
    header: 'Started',
    cell: ({ row }) => {
      const createdAt = new Date(row.original.createdAt);

      return (
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">{createdAt.toLocaleDateString()}</p>
          <p className="font-mono text-xs text-muted-foreground">{createdAt.toLocaleTimeString()}</p>
        </div>
      );
    },
  },
  {
    accessorKey: 'durationMs',
    header: 'Duration',
    cell: ({ row }) => {
      const durationMs = row.original.completedAt
        ? Math.max(new Date(row.original.completedAt).getTime() - new Date(row.original.createdAt).getTime(), 0)
        : null;

      return (
        <div className="space-y-1 text-sm">
          <p
            className="font-mono text-xs font-bold tracking-[0.12em] text-foreground"
            title={durationMs != null ? `Duration: ${formatDurationExact(durationMs)}` : undefined}
          >
            {computeDuration(row.original.createdAt, row.original.completedAt) ?? 'Running'}
          </p>
          <p className="text-xs text-muted-foreground">{formatDateTime(row.original.completedAt)}</p>
        </div>
      );
    },
  },
];

export function ScrapeListPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [sortState, setSortState] = useState<DataTableSort>({
    key: 'createdAt',
    direction: 'desc',
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const debouncedUrl = useDebouncedValue(url, 300);

  const { data, isLoading, error } = useScrapes({
    status: status || undefined,
    url: debouncedUrl || undefined,
    limit: pageSize,
    offset: page * pageSize,
    sort: sortState.key,
    order: sortState.direction,
  });

  const hasActiveFilters = Boolean(status) || Boolean(url);

  const resetFilters = () => {
    setStatus('');
    setUrl('');
    setPage(0);
  };

  return (
    <Page>
      <PageHeader
        title="Scrapes"
        description={data ? `${data.total} captured job${data.total === 1 ? '' : 's'} in the scrape history.` : 'Single-page scraping jobs'}
      >
        <Button onClick={() => router.push('/scrape/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Scrape
        </Button>
      </PageHeader>
      <PageBody>
        <div className="space-y-3">
          <FilterBar
            filters={[
              {
                id: 'url',
                label: 'URL',
                type: 'text',
                placeholder: 'Filter by URL',
              },
              {
                id: 'status',
                label: 'Status',
                type: 'select',
                showAllOption: true,
                options: [
                  { label: 'Pending', value: 'PENDING' },
                  { label: 'Processing', value: 'PROCESSING' },
                  { label: 'Completed', value: 'COMPLETED' },
                  { label: 'Failed', value: 'FAILED' },
                ],
              },
            ]}
            values={{ status, url }}
            onChange={(id, value) => {
              if (id === 'status') {
                setStatus(value);
                setPage(0);
              }

              if (id === 'url') {
                setUrl(value);
                setPage(0);
              }
            }}
          />

          <DataLoader isLoading={false} error={error}>
            {!isLoading && !error && data?.data.length === 0 ? (
              <EmptyState
                icon={<FileSearch className="h-10 w-10" />}
                title={hasActiveFilters ? 'No Matching Scrapes' : 'No Scrapes Yet'}
                description={hasActiveFilters
                  ? 'No scrape jobs match the current filters. Clear filters to see more results.'
                  : 'Start a new scrape to capture rendered website content, metadata, links, screenshots, or structured extracted artefacts.'}
                action={
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {hasActiveFilters ? (
                      <Button variant="outline" onClick={resetFilters}>
                        Clear Filters
                      </Button>
                    ) : null}
                    <Button onClick={() => router.push('/scrape/new')}>
                      <Plus className="mr-2 h-4 w-4" />
                      New Scrape
                    </Button>
                  </div>
                }
                className="min-h-[280px] border-0 bg-transparent px-0 py-12 shadow-none"
              />
            ) : (
              <DataTable
                columns={columns}
                data={data?.data ?? []}
                sort={sortState}
                sortableColumns={{
                  url: 'url',
                  status: 'status',
                  createdAt: 'createdAt',
                  durationMs: 'durationMs',
                }}
                onSortChange={(nextSort) => {
                  setSortState(nextSort);
                  setPage(0);
                }}
                isLoading={isLoading}
                pagination={{ page, pageSize, total: data?.total ?? 0 }}
                onPaginationChange={setPage}
                onPageSizeChange={(nextPageSize) => {
                  setPageSize(nextPageSize);
                  setPage(0);
                }}
                showPageSizeControl
                onRowClick={(row) => router.push(`/scrape/${row.id}`)}
              />
            )}
          </DataLoader>
        </div>
      </PageBody>
    </Page>
  );
}
