'use client';

import { useEffect, useMemo, useState } from 'react';
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
  FilterBar,
  Page,
  PageBody,
  PageHeader,
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
  useDebouncedValue,
  timeAgo,
  formatDuration,
  formatDurationExact,
  computeDuration,
  formatTimestamp,
} from '@tentacrawl/ui';
import { ArrowLeft, Ban, Clock3, ExternalLink, SearchCode, Settings2, Timer } from 'lucide-react';
import { extractUrlHostname, extractUrlPath } from '@tentacrawl/core/url';
import type { CrawlPageStatus } from '@tentacrawl/core/schema';
import type { CrawlPageListItem } from '../../../../data/schemas';
import { CrawlPageResultViewer } from '../../../components/crawl-page-result-viewer';
import { CrawlPageStatusBadge } from '../../../components/crawl-page-status-badge';
import { CrawlStatusBadge } from '../../../components/crawl-status-badge';
import { useCancelCrawl, useCrawl, useCrawlPage, useCrawlPages } from '../../../hooks/use-crawls';

function formatNetworkPolicy(policy?: { mode: string; poolId?: string; proxy?: { server: string } }) {
  if (!policy) {
    return 'Unknown';
  }

  if (policy.mode === 'managed') {
    return policy.poolId ? `Managed (${policy.poolId})` : 'Managed';
  }

  if (policy.mode === 'static') {
    return policy.proxy?.server ? `Static (${policy.proxy.server})` : 'Static';
  }

  return 'Direct';
}

function formatConfigValue(value?: string) {
  return value && value.length > 0 ? value : 'Not set';
}

function formatArtefactsSummary(artefacts?: string[]) {
  if (!artefacts?.length) {
    return 'Not set';
  }

  if (artefacts.length === 1) {
    return artefacts[0];
  }

  return `${artefacts.length} artefacts`;
}

function ConfigItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={mono ? 'break-all font-mono text-xs text-foreground' : 'text-sm text-foreground'}>{value}</p>
    </div>
  );
}

export function CrawlDetailPage({ id, initialInspectPageId }: { id: string; initialInspectPageId?: string }) {
  const router = useRouter();
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [pageStatus, setPageStatus] = useState<string>('');
  const [pageUrl, setPageUrl] = useState<string>('');
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 20;
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const debouncedPageUrl = useDebouncedValue(pageUrl, 300);

  useEffect(() => {
    if (!initialInspectPageId) {
      return;
    }

    setSelectedPageId(initialInspectPageId);
    router.replace(`/crawl/${id}`);
  }, [id, initialInspectPageId, router]);

  const crawlQuery = useCrawl(id);
  const pagesQuery = useCrawlPages(id, {
    status: pageStatus || undefined,
    url: debouncedPageUrl || undefined,
    limit: pageSize,
    offset: pageIndex * pageSize,
  });
  const processingPagesQuery = useCrawlPages(id, {
    status: 'PROCESSING',
    limit: 1,
    offset: 0,
  });
  const pageDetailQuery = useCrawlPage(id, selectedPageId);
  const cancelCrawl = useCancelCrawl();

  const crawl = crawlQuery.data;
  const pages = pagesQuery.data?.data ?? [];
  const isActive = crawl ? crawl.status === 'PENDING' || crawl.status === 'PROCESSING' : false;
  const resolvedPages = crawl ? crawl.completedPages + crawl.failedPages : 0;
  const knownPages = crawl ? Math.max(crawl.totalPages, resolvedPages) : 0;
  const completionRate = knownPages > 0 ? Math.round((resolvedPages / knownPages) * 100) : 0;
  const statusControlValue = pageStatus;

  const pageBuckets = [
    {
      label: 'Known Pages',
      value: knownPages,
      description: 'All pages discovered for this crawl.',
      filterValue: '',
    },
    {
      label: 'Processing',
      value: processingPagesQuery.data?.total ?? 0,
      description: 'Pages currently being processed.',
      filterValue: 'PROCESSING',
    },
    {
      label: 'Resolved',
      value: crawl?.completedPages ?? 0,
      description: 'Pages that completed successfully.',
      filterValue: 'COMPLETED',
    },
    {
      label: 'Failures',
      value: crawl?.failedPages ?? 0,
      description: 'Pages with failed outcomes.',
      filterValue: 'FAILED',
    },
  ] as const;

  const columns = useMemo<ColumnDef<CrawlPageListItem>[]>(() => [
    {
      accessorKey: 'url',
      header: 'Page URL',
      cell: ({ row }) => {
        const url = row.original.url;
        return (
          <div className="flex max-w-[420px] items-center justify-between gap-3" title={url}>
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-sm font-semibold text-foreground" title={url}>{extractUrlHostname(url)}</p>
              <p className="truncate font-mono text-xs text-muted-foreground" title={url}>{extractUrlPath(url)}</p>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground transition-colors hover:text-brand"
              onClick={(event) => event.stopPropagation()}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        );
      },
    },
    {
      accessorKey: 'depth',
      header: 'Depth',
      cell: ({ row }) => <span className="font-mono text-xs font-bold">{row.original.depth}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <CrawlPageStatusBadge status={row.original.status as CrawlPageStatus} />,
    },
    {
      accessorKey: 'discoveredUrlCount',
      header: 'Links Found',
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.discoveredUrlCount}</span>,
    },
    {
      accessorKey: 'durationMs',
      header: 'Duration',
      cell: ({ row }) => {
        if (row.original.status === 'SKIPPED') {
          return <span className="font-mono text-xs text-muted-foreground" />;
        }

        return (
          <span
            className="font-mono text-xs"
            title={row.original.durationMs != null ? `Duration: ${formatDurationExact(row.original.durationMs)}` : undefined}
          >
            {formatDuration(row.original.durationMs)}
          </span>
        );
      },
    },
    {
      id: 'inspect',
      header: 'Inspect',
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedPageId(row.original.id);
          }}
        >
          <SearchCode className="h-3.5 w-3.5" />
          Inspect
        </Button>
      ),
    },
  ], []);

  return (
    <Page>
      <PageHeader
        title="Crawl Detail"
        description={crawl?.url ?? id}
      >
        {isActive ? (
          <Button
            variant="destructive"
            size="sm"
            disabled={cancelCrawl.isPending}
            onClick={() => setIsCancelDialogOpen(true)}
          >
            <Ban className="h-3.5 w-3.5" />
            Cancel Crawl
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => router.push('/crawl')}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
      </PageHeader>
      <PageBody>
        <DataLoader isLoading={crawlQuery.isLoading} error={crawlQuery.error}>
          {crawl ? (
            <div className="space-y-6">
              <Panel variant="brutal">
                <PanelContent>
                  <div className="flex flex-col gap-5 lg:flex-row lg:gap-6">
                    <div className="min-w-0 flex-1 space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <CrawlStatusBadge status={crawl.status} />
                          <span className="h-3.5 w-px bg-ink/15" aria-hidden />
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock3 className="h-3 w-3" />
                            {crawl.completedAt ? (
                              <span title={formatTimestamp(crawl.completedAt)}>
                                {timeAgo(crawl.completedAt)}
                              </span>
                            ) : (
                              <span title={formatTimestamp(crawl.createdAt)}>Started {timeAgo(crawl.createdAt)}</span>
                            )}
                            {computeDuration(crawl.createdAt, crawl.completedAt) ? (
                              <>
                                <span className="h-3.5 w-px bg-ink/15" aria-hidden />
                                <Timer className="h-3 w-3" />
                                <span title={`Duration: ${formatDurationExact(Math.max((new Date(crawl.completedAt ?? Date.now()).getTime()) - new Date(crawl.createdAt).getTime(), 0))}`}>{computeDuration(crawl.createdAt, crawl.completedAt)}</span>
                              </>
                            ) : null}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                            onClick={() => setIsConfigDialogOpen(true)}
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                            Full Config
                          </button>
                        </div>
                      </div>

                      <div className="flex items-baseline gap-2.5">
                        <h2 className="text-xl font-bold tracking-tight text-foreground">{extractUrlHostname(crawl.url)}</h2>
                        <a href={crawl.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground/60 transition-colors hover:text-brand">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>

                      <div className="border-t border-ink/10 pt-4">
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                          <div>
                            <dt className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Progress</dt>
                            <dd className="mt-1 text-sm font-semibold text-foreground">{completionRate}%<span className="ml-1 font-normal text-muted-foreground">({resolvedPages}/{knownPages || 0})</span></dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Proxy</dt>
                            <dd className="mt-1 text-sm font-semibold text-foreground">{formatNetworkPolicy(crawl.networkPolicy)}</dd>
                          </div>
                          <div className="col-span-2">
                            <dt className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Artefacts</dt>
                            <dd className="mt-1 text-sm font-semibold text-foreground">{formatArtefactsSummary(crawl.artefacts)}</dd>
                          </div>
                        </dl>
                      </div>

                      {isActive ? (
                        <p className="text-[13px] text-brand">
                          Crawl is still running — new pages will appear automatically.
                        </p>
                      ) : null}
                    </div>
                    <div className="grid min-w-[240px] gap-1 border-t border-ink/10 pt-4 lg:min-w-[260px] lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                      {pageBuckets.map((bucket) => {
                        const isSelected = pageStatus === bucket.filterValue;

                        return (
                          <button
                            key={bucket.label}
                            type="button"
                            className={[
                              'flex flex-col justify-center border-l-2 px-3 py-2 text-left transition-colors',
                              isSelected
                                ? 'border-ink/20 text-foreground'
                                : 'border-transparent text-muted-foreground hover:border-ink/10 hover:text-foreground',
                            ].join(' ')}
                            onClick={() => {
                              setPageStatus(bucket.filterValue);
                              setPageIndex(0);
                            }}
                          >
                            <div className="flex items-baseline gap-2">
                              <span className="text-lg font-bold tracking-tight">{bucket.value}</span>
                              <span className="text-[11px] font-medium uppercase tracking-wide">{bucket.label}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{bucket.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </PanelContent>
              </Panel>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold text-foreground">Crawled Pages</h2>
                </div>

                <FilterBar
                  filters={[
                    {
                      id: 'url',
                      label: 'URL',
                      type: 'text',
                      placeholder: 'Filter pages by URL',
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
                        { label: 'Skipped', value: 'SKIPPED' },
                      ],
                    },
                  ]}
                  values={{ status: statusControlValue, url: pageUrl }}
                  onChange={(filterId, value) => {
                    if (filterId === 'url') {
                      setPageUrl(value);
                      setPageIndex(0);
                    }
                    if (filterId === 'status') {
                      setPageStatus(value);
                      setPageIndex(0);
                    }
                  }}
                />

                <DataLoader isLoading={false} error={pagesQuery.error}>
                  <DataTable
                    columns={columns}
                    data={pages}
                    isLoading={pagesQuery.isLoading}
                    className="[&_th]:h-9 [&_th]:px-3 [&_td]:align-middle [&_td]:px-3 [&_td]:py-2.5"
                    pagination={{ page: pageIndex, pageSize, total: pagesQuery.data?.total ?? 0 }}
                    onPaginationChange={setPageIndex}
                    onRowClick={(row) => setSelectedPageId(row.id)}
                    emptyMessage="No crawl pages match the current filter."
                  />
                </DataLoader>
              </section>
            </div>
          ) : null}
        </DataLoader>

        <Dialog open={selectedPageId != null} onOpenChange={(open) => {
          if (!open) {
            setSelectedPageId(null);
          }
        }}>
          <DialogContent className="max-h-[90vh] max-w-5xl overflow-x-hidden overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Page Inspection</DialogTitle>
              <DialogDescription>
                Review the stored execution result and discovered frontier for a single crawled page.
              </DialogDescription>
            </DialogHeader>

            <DataLoader isLoading={pageDetailQuery.isLoading} error={pageDetailQuery.error}>
              {pageDetailQuery.data ? (
                <div className="min-w-0 space-y-4 p-6">
                  <Panel variant="brutal">
                    <PanelHeader variant="brutal">
                      <PanelTitle>Page Overview</PanelTitle>
                    </PanelHeader>
                    <PanelContent>
                      <dl className="grid gap-5 text-sm md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <dt className="text-xs font-bold uppercase tracking-wider text-muted">Status</dt>
                          <dd className="mt-2"><CrawlPageStatusBadge status={pageDetailQuery.data.status} /></dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold uppercase tracking-wider text-muted">Depth</dt>
                          <dd className="mt-2 font-mono text-sm">{pageDetailQuery.data.depth}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold uppercase tracking-wider text-muted">Created</dt>
                          <dd className="mt-2 font-medium">{formatTimestamp(pageDetailQuery.data.createdAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-bold uppercase tracking-wider text-muted">Completed</dt>
                          <dd className="mt-2 font-medium">{formatTimestamp(pageDetailQuery.data.completedAt)}</dd>
                        </div>
                        <div className="md:col-span-2 xl:col-span-4">
                          <dt className="text-xs font-bold uppercase tracking-wider text-muted">URL</dt>
                          <dd className="mt-2 flex items-start gap-2">
                            <span className="break-all font-mono text-xs text-foreground">{pageDetailQuery.data.url}</span>
                            <a
                              href={pageDetailQuery.data.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-muted-foreground transition-colors hover:text-brand"
                              aria-label="Open page URL in a new tab"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </dd>
                        </div>
                      </dl>
                    </PanelContent>
                  </Panel>

                  <CrawlPageResultViewer page={pageDetailQuery.data} />
                </div>
              ) : null}
            </DataLoader>
          </DialogContent>
        </Dialog>

        <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crawl Configuration</DialogTitle>
              <DialogDescription>
                Full settings for this run
              </DialogDescription>
            </DialogHeader>

            {crawl ? (
              <div className="space-y-6 p-6">
                <section className="space-y-3 border-l-2 border-ink/20 pl-5">
                  <h3 className="text-sm font-semibold text-foreground">Seed &amp; Scope</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <ConfigItem label="Start URL" value={crawl.url} mono />
                    <ConfigItem label="Maximum Depth" value={String(crawl.maxDepth ?? '—')} />
                    <ConfigItem label="Maximum Pages" value={String(crawl.maxPages ?? '—')} />
                  </div>
                </section>

                <section className="space-y-3 border-l-2 border-ink/20 pl-5">
                  <h3 className="text-sm font-semibold text-foreground">Artefacts</h3>
                  <ConfigItem label="Stored Artefacts" value={formatArtefactsSummary(crawl.artefacts)} />
                </section>

                <section className="space-y-3 border-l-2 border-ink/20 pl-5">
                  <h3 className="text-sm font-semibold text-foreground">URL Frontier Rules</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <ConfigItem label="Include Pattern" value={formatConfigValue(crawl.includePattern)} mono />
                    <ConfigItem label="Exclude Pattern" value={formatConfigValue(crawl.excludePattern)} mono />
                  </div>
                </section>

                <section className="space-y-3 border-l-2 border-ink/20 pl-5">
                  <h3 className="text-sm font-semibold text-foreground">Network</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <ConfigItem label="Routing" value={formatNetworkPolicy(crawl.networkPolicy)} />
                    <ConfigItem label="Header Count" value={String(Object.keys(crawl.headers ?? {}).length)} />
                  </div>
                </section>

                <section className="space-y-3 border-l-2 border-ink/20 pl-5">
                  <h3 className="text-sm font-semibold text-foreground">Advanced Options</h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <ConfigItem label="Wait Until" value={formatConfigValue(crawl.waitFor)} />
                    <ConfigItem label="Timeout" value={crawl.timeout != null ? `${crawl.timeout}ms` : 'Not set'} />
                    <ConfigItem label="Locale" value={crawl.locale ?? 'Default'} />
                    <ConfigItem label="Timezone" value={crawl.timezone ?? 'Default'} />
                  </div>
                  <ConfigItem
                    label="Custom Headers"
                    value={Object.keys(crawl.headers ?? {}).length
                      ? Object.entries(crawl.headers ?? {}).map(([key, value]) => `${key}: ${value}`).join(' | ')
                      : 'None'}
                  />
                  <ConfigItem label="DSL Script" value={crawl.dsl ? 'Custom DSL attached' : 'None'} />
                </section>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cancel Crawl?</DialogTitle>
              <DialogDescription>
                {crawl
                  ? `This will stop the crawl for ${crawl.url}. Pending pages will not continue processing.`
                  : 'This will stop the selected crawl. Pending pages will not continue processing.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCancelDialogOpen(false)}
                disabled={cancelCrawl.isPending}
              >
                Keep Crawl
              </Button>
              <Button
                variant="destructive"
                disabled={cancelCrawl.isPending}
                onClick={() => {
                  cancelCrawl.mutate(id, {
                    onSettled: () => setIsCancelDialogOpen(false),
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