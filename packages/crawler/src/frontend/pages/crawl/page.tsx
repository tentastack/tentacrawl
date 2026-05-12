'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Button,
  DataLoader,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FilterBar,
  Page,
  PageBody,
  PageHeader,
  type DataTableSort,
  useDebouncedValue,
  computeDuration,
  formatDurationExact,
} from '@tentacrawl/ui';
import {
  ExternalLink,
  Plus,
  ScanSearch,
} from 'lucide-react';
import { extractUrlHostname } from '@tentacrawl/core/url';
import type { CrawlStatus } from '@tentacrawl/core/schema';
import type { CrawlResponse } from '../../../data/schemas';
import { CrawlStatusBadge } from '../../components/crawl-status-badge';
import { useCancelCrawl, useCrawls } from '../../hooks/use-crawls';

function formatDateTime(value?: string) {
  if (!value) {
    return 'In progress';
  }

  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

const columns: ColumnDef<CrawlResponse>[] = [
  {
    accessorKey: 'url',
    header: 'Seed URL',
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
    cell: ({ row }) => <CrawlStatusBadge status={row.original.status as CrawlStatus} />,
  },
  {
    accessorKey: 'totalPages',
    header: 'Page Coverage',
    cell: ({ row }) => {
      const { totalPages, completedPages, failedPages } = row.original;
      const resolvedPages = completedPages + failedPages;
      const knownPages = Math.max(totalPages, resolvedPages);
      const queuedPages = Math.max(knownPages - resolvedPages, 0);
      const summary = failedPages > 0 && queuedPages > 0
        ? `${failedPages} failed, ${queuedPages} queued`
        : failedPages > 0
          ? `${failedPages} failed`
          : queuedPages > 0
            ? `${queuedPages} queued`
            : null;

      return (
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">
            {completedPages} / {knownPages || 0} completed
          </p>
          {summary ? <p className="text-xs text-muted-foreground">{summary}</p> : null}
        </div>
      );
    },
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
    id: 'runtime',
    header: 'Runtime',
    enableSorting: false,
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

export function CrawlListPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [sortState, setSortState] = useState<DataTableSort>({
    key: 'createdAt',
    direction: 'desc',
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const debouncedUrl = useDebouncedValue(url, 300);

  const crawlsQuery = useCrawls({
    status: status || undefined,
    url: debouncedUrl || undefined,
    limit: pageSize,
    offset: page * pageSize,
    sort: sortState.key,
    order: sortState.direction,
  });
  const { data, isLoading, error } = crawlsQuery;
  const cancelCrawl = useCancelCrawl();

  const crawls = data?.data ?? [];
  const hasActiveFilters = Boolean(status) || Boolean(url);
  const pendingCancelCrawl = pendingCancelId ? crawls.find((crawl) => crawl.id === pendingCancelId) ?? null : null;

  const tableColumns = useMemo<ColumnDef<CrawlResponse>[]>(() => [
    ...columns,
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const crawl = row.original;
        const isActive = crawl.status === 'PENDING' || crawl.status === 'PROCESSING';

        if (!isActive) {
          return <span className="text-xs text-muted-foreground">No actions</span>;
        }

        return (
          <Button
            variant="outline"
            size="sm"
            disabled={cancelCrawl.isPending}
            onClick={(event) => {
              event.stopPropagation();
              setPendingCancelId(crawl.id);
            }}
          >
            Cancel
          </Button>
        );
      },
    },
  ], [cancelCrawl]);

  return (
    <Page>
      <PageHeader
        title="Crawls"
        description={data
          ? `${data.total} crawl run${data.total === 1 ? '' : 's'} tracked across the queue and execution history.`
          : 'Multi-page crawl runs with bounded scope, queue tracking, and per-run artefact settings.'}
      >
        <Button onClick={() => router.push('/crawl/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Crawl
        </Button>
      </PageHeader>
      <PageBody>
        <div className="space-y-6">
          <div className="space-y-3">
            <FilterBar
              filters={[
                {
                  id: 'url',
                  label: 'Seed URL',
                  type: 'text',
                  placeholder: 'Filter by seed URL',
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
                    { label: 'Cancelled', value: 'CANCELLED' },
                  ],
                },
              ]}
              values={{ status, url }}
              onChange={(id, value) => {
                if (id === 'url') {
                  setUrl(value);
                  setPage(0);
                }
                if (id === 'status') {
                  setStatus(value);
                  setPage(0);
                }
              }}
            />

            <DataLoader isLoading={false} error={error}>
              {!isLoading && !error && crawls.length === 0 ? (
                <EmptyState
                  icon={<ScanSearch className="h-10 w-10" />}
                  title={hasActiveFilters ? 'No Matching Crawls' : 'No Crawls Yet'}
                  description={hasActiveFilters
                    ? 'No crawl runs match the current filters. Clear them or start a new crawl.'
                    : 'Create a crawl to explore a site over multiple pages with depth, page-budget, and URL frontier controls.'}
                  action={
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {hasActiveFilters ? (
                        <Button variant="outline" onClick={() => {
                          setStatus('');
                          setUrl('');
                          setPage(0);
                        }}>
                          Clear Filters
                        </Button>
                      ) : null}
                      <Button onClick={() => router.push('/crawl/new')}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Crawl
                      </Button>
                    </div>
                  }
                  className="min-h-[280px] border-0 bg-transparent px-0 py-12 shadow-none"
                />
              ) : (
                <DataTable
                  columns={tableColumns}
                  data={crawls}
                  sort={sortState}
                  sortableColumns={{
                    status: 'status',
                    totalPages: 'totalPages',
                    createdAt: 'createdAt',
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
                  onRowClick={(row) => router.push(`/crawl/${row.id}`)}
                />
              )}
            </DataLoader>
          </div>
        </div>

        <Dialog open={pendingCancelId != null} onOpenChange={(open) => {
          if (!open) {
            setPendingCancelId(null);
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cancel Crawl?</DialogTitle>
              <DialogDescription>
                {pendingCancelCrawl
                  ? `This will stop the crawl for ${pendingCancelCrawl.url}. Pending pages will not continue processing.`
                  : 'This will stop the selected crawl. Pending pages will not continue processing.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPendingCancelId(null)}
                disabled={cancelCrawl.isPending}
              >
                Keep Crawl
              </Button>
              <Button
                variant="destructive"
                disabled={cancelCrawl.isPending || pendingCancelId == null}
                onClick={() => {
                  if (!pendingCancelId) {
                    return;
                  }

                  cancelCrawl.mutate(pendingCancelId, {
                    onSettled: () => setPendingCancelId(null),
                  });
                }}
              >
                Confirm Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageBody>
    </Page>
  );
}