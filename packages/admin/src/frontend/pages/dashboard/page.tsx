'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import {
  cn,
  DataLoader,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  Page,
  PageBody,
  PageHeader,
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
  Spinner,
  StatCard,
  StatusDot,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  formatDuration,
  timeAgo,
} from '@tentacrawl/ui';
import type { ReactNode } from 'react';
import type { ActivityLogItem, WorkerSummary } from '../../../data/schemas';
import {
  useDashboardActivity,
  useDashboardOverview,
  useDashboardWorkers,
} from '../../hooks/use-dashboard';

const ACTIVITY_LOG_PAGE_SIZE = 12;
const ACTIVITY_LOG_SCROLL_ROOT_MARGIN = '160px 0px';

export interface DashboardPageProps {
  scrapeHref?: string;
  crawlHref?: string;
  resolveActivityHref?: (event: ActivityLogItem) => string | null;
}

function toDotStatus(status: WorkerSummary['status'] | 'info' | 'success' | 'warning' | 'error') {
  switch (status) {
    case 'healthy':
    case 'success':
      return 'success';
    case 'stale':
    case 'warning':
      return 'warning';
    case 'offline':
    case 'error':
      return 'error';
    default:
      return 'info';
  }
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatMetricValue(value: number | null | undefined) {
  return typeof value === 'number' ? formatCount(value) : '-';
}

function PanelError({ message }: { message: string }) {
  return <p className="text-sm text-destructive">{message}</p>;
}

function ActivityLogEntry({
  event,
  resolveActivityHref,
}: {
  event: ActivityLogItem;
  resolveActivityHref?: (event: ActivityLogItem) => string | null;
}) {
  const href = resolveActivityHref?.(event) ?? null;
  const isClickable = href !== null;

  const content = (
    <div className="flex items-start justify-between gap-4 px-5 py-4 text-sm">
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          <StatusDot status={toDotStatus(event.severity)} size="md" />
        </div>
        <div>
          <p className="font-medium">{event.title}</p>
          <p className="mt-1 text-muted">{event.message}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-muted">{event.source}</p>
        </div>
      </div>
      <span className="shrink-0 text-xs text-muted">{timeAgo(event.createdAt)}</span>
    </div>
  );

  const className = cn(
    'block text-left transition-colors',
    isClickable ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40' : '',
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return content;
}

function QueueOverviewContent({
  overview,
  isLoading,
  error,
}: {
  overview: typeof useDashboardOverview extends () => infer T ? T extends { data?: infer U } ? U : never : never;
  isLoading: boolean;
  error: Error | null;
}) {
  return (
    <DataLoader isLoading={isLoading && !overview} error={error}>
      {overview ? overview.queues.map((queue) => (
        <div key={queue.id} className="border border-ink/10 p-4">
          <div>
            <div>
              <p className="font-semibold">{queue.label}</p>
              <p className="mt-1 text-xs text-muted">Concurrency {formatCount(queue.concurrency)}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            <div>
              <p className="text-xs text-muted">Waiting</p>
              <p className="font-bold">{formatCount(queue.waiting)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Active</p>
              <p className="font-bold">{formatCount(queue.active)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Done</p>
              <p className="font-bold">{formatCount(queue.completed)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Failed</p>
              <p className="font-bold">{formatCount(queue.failed)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Delayed</p>
              <p className="font-bold">{formatCount(queue.delayed)}</p>
            </div>
          </div>
        </div>
      )) : <PanelError message="Queue overview is currently unavailable." />}
    </DataLoader>
  );
}

function WorkerDialog({ workers, trigger }: { workers: WorkerSummary[]; trigger: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Workers status</DialogTitle>
          <DialogDescription>
            Live worker health, heartbeat freshness, and uptime.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Heartbeat</TableHead>
                <TableHead>Uptime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.map((worker) => (
                <TableRow key={worker.workerId} className="hover:bg-transparent">
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-semibold">{worker.hostname}:{worker.port}</p>
                      <p className="text-xs text-muted">PID {worker.pid} · v{worker.version}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusDot status={toDotStatus(worker.status)} />
                      <span className="capitalize">{worker.status}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted">{timeAgo(worker.lastHeartbeatAt)}</TableCell>
                  <TableCell className="text-sm text-muted">{formatDuration(worker.uptimeMs)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QueueDialog({
  overview,
  isLoading,
  error,
  trigger,
}: {
  overview: typeof useDashboardOverview extends () => infer T ? T extends { data?: infer U } ? U : never : never;
  isLoading: boolean;
  error: Error | null;
  trigger: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Queue status</DialogTitle>
          <DialogDescription>
            Live status across scraper, crawl orchestration, and crawl page queues.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto p-6">
          <div className="space-y-4">
            <QueueOverviewContent overview={overview} isLoading={isLoading} error={error} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DashboardPage({
  scrapeHref = '/scrape',
  crawlHref = '/crawl',
  resolveActivityHref,
}: DashboardPageProps = {}) {
  const overviewQuery = useDashboardOverview();
  const workersQuery = useDashboardWorkers();
  const activityQuery = useDashboardActivity({
    limit: ACTIVITY_LOG_PAGE_SIZE,
  });
  const activityScrollViewportRef = useRef<HTMLDivElement | null>(null);
  const activityLoadMoreRef = useRef<HTMLDivElement | null>(null);

  const overview = overviewQuery.data;
  const workers = workersQuery.data ?? [];
  const activityPages = activityQuery.data?.pages ?? [];
  const activities = activityPages.flatMap((page) => page.data);
  const healthyWorkers = workers.filter((worker) => worker.status === 'healthy').length;
  const totalActivities = activityPages[0]?.total ?? 0;
  const loadedActivities = activities.length;

  useEffect(() => {
    const root = activityScrollViewportRef.current;
    const target = activityLoadMoreRef.current;

    if (!root || !target) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || !activityQuery.hasNextPage || activityQuery.isFetchingNextPage) {
          return;
        }

        void activityQuery.fetchNextPage();
      },
      {
        root,
        rootMargin: ACTIVITY_LOG_SCROLL_ROOT_MARGIN,
      },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [activityQuery.fetchNextPage, activityQuery.hasNextPage, activityQuery.isFetchingNextPage]);

  return (
    <Page>
      <PageHeader
        title="Dashboard"
        description="Live operational view across workers, queues, crawler, and scraper"
        descriptionClassName="text-muted"
      />

      <PageBody className="space-y-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link href={scrapeHref} className="block">
            <StatCard
              label="Total scrapes"
              value={formatMetricValue(overview?.stats.totalScrapes)}
              className="transition-colors hover:bg-surface"
            />
          </Link>
          <Link href={crawlHref} className="block">
            <StatCard
              label="Total crawls"
              value={formatMetricValue(overview?.stats.totalCrawls)}
              className="transition-colors hover:bg-surface"
            />
          </Link>
          <QueueDialog
            overview={overview}
            isLoading={overviewQuery.isLoading}
            error={overviewQuery.error}
            trigger={(
              <div className="cursor-pointer">
                <StatCard
                  label="Queued or active jobs"
                  value={formatMetricValue(overview?.stats.activeJobs)}
                  className="transition-colors hover:bg-surface"
                />
              </div>
            )}
          />
          <WorkerDialog
            workers={workers}
            trigger={(
              <div className="cursor-pointer">
                <StatCard
                  label="Healthy workers"
                  value={workersQuery.data ? formatCount(healthyWorkers) : formatMetricValue(overview?.stats.activeWorkers)}
                  className="transition-colors hover:bg-surface"
                />
              </div>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Panel>
            <PanelHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <PanelTitle>Activity log</PanelTitle>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>
                    {activities.length > 0
                      ? `Loaded ${formatCount(loadedActivities)} of ${formatCount(totalActivities)}`
                      : 'No events yet'}
                  </span>
                  {activityQuery.isFetchingNextPage ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner className="size-3.5" />
                      Loading more
                    </span>
                  ) : null}
                </div>
              </div>
            </PanelHeader>
            <PanelContent className="p-0">
              <DataLoader isLoading={activityQuery.isLoading && !activityQuery.data} error={activityQuery.data ? null : activityQuery.error}>
                {activities.length > 0 ? (
                  <div ref={activityScrollViewportRef} className="max-h-[34rem] overflow-y-auto overscroll-contain">
                    <div className="divide-y divide-ink/5">
                      {activities.map((event) => (
                        <ActivityLogEntry
                          key={event.id}
                          event={event}
                          resolveActivityHref={resolveActivityHref}
                        />
                      ))}

                      {activityQuery.hasNextPage ? (
                        <div ref={activityLoadMoreRef} className="flex items-center justify-center px-5 py-4 text-xs uppercase tracking-[0.18em] text-muted">
                          {activityQuery.isFetchingNextPage ? 'Loading more events' : 'Scroll for more'}
                        </div>
                      ) : null}

                      {activityQuery.isFetchNextPageError ? (
                        <div className="px-5 py-4">
                          <PanelError message={activityQuery.error?.message ?? 'Unable to load older activity events.'} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No activity yet"
                    description="Job lifecycle events will appear here once workers start processing crawl and scrape tasks."
                    className="m-5"
                  />
                )}
              </DataLoader>
            </PanelContent>
          </Panel>
        </div>
      </PageBody>
    </Page>
  );
}
