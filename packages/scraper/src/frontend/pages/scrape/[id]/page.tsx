'use client';

import { useRouter } from 'next/navigation';
import {
  Page, PageHeader, PageBody,
  DataLoader, Button,
  Panel, PanelContent, PanelHeader, PanelTitle,
  StatCard,
  formatDuration,
  formatTimestamp,
} from '@tentacrawl/ui';
import { ArrowLeft, CheckCircle2, Clock3, ExternalLink, FileText } from 'lucide-react';
import { useScrape } from '../../../hooks/use-scrapes';
import { ScrapeStatusBadge } from '../../../components/scrape-status-badge';
import { ScrapeResultViewer } from '../../../components/scrape-result-viewer';
import type { TaskStatus } from '../../../../data/schemas';

export function ScrapeDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const { data, isLoading, error } = useScrape(id);
  const artefactCount = Object.values(data?.result?.artefacts ?? {}).filter((value) => value != null).length;
  const durationMs = typeof data?.result?.durationMs === 'number' ? data.result.durationMs : undefined;
  const isPending = data && (data.status === 'PENDING' || data.status === 'PROCESSING');
  const isFailed = data?.status === 'FAILED';

  return (
    <Page>
      <PageHeader
        title="Scrape Detail"
        description={data?.url ?? id}
      >
        <Button variant="ghost" size="sm" onClick={() => router.push('/scrape')}>
          <ArrowLeft className="mr-2 h-3.5 w-3.5" />
          Back
        </Button>
      </PageHeader>
      <PageBody>
        <DataLoader isLoading={isLoading} error={error}>
          {data && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Status"
                  value={data.status}
                  icon={CheckCircle2}
                  variant="brutal"
                />
                <StatCard
                  label="Duration"
                  value={formatDuration(durationMs)}
                  icon={Clock3}
                  variant="brutal"
                />
                <StatCard
                  label="Artefacts"
                  value={artefactCount || '0'}
                  icon={FileText}
                  variant="brutal"
                />
                <StatCard
                  label="Completed"
                  value={data.completedAt ? formatTimestamp(data.completedAt) : 'Not yet'}
                  icon={Clock3}
                  variant="brutal"
                />
              </div>

              <Panel variant="brutal">
                <PanelHeader variant="brutal">
                  <PanelTitle>Overview</PanelTitle>
                </PanelHeader>
                <PanelContent>
                  <dl className="grid gap-5 text-sm md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-muted">Status</dt>
                      <dd className="mt-2">
                        <ScrapeStatusBadge status={data.status as TaskStatus} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-muted">URL</dt>
                      <dd className="mt-2 flex items-center gap-2">
                        <span className="truncate font-mono text-xs">{data.url}</span>
                        <a href={data.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted hover:text-ink">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-muted">Origin</dt>
                      <dd className="mt-2 font-mono text-xs text-foreground">{data.origin}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-muted">Created</dt>
                      <dd className="mt-2 font-medium">{formatTimestamp(data.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-muted">ID</dt>
                      <dd className="mt-2 break-all font-mono text-xs text-foreground">{data.id}</dd>
                    </div>
                  </dl>
                </PanelContent>
              </Panel>

              {isPending ? (
                <Panel variant="brutal">
                  <PanelHeader variant="brutal">
                    <PanelTitle>Scrape in progress</PanelTitle>
                  </PanelHeader>
                  <PanelContent>
                    <p className="text-sm text-muted">
                      This scrape is still running. The page auto-refreshes while the job is pending or processing.
                    </p>
                  </PanelContent>
                </Panel>
              ) : null}

              {isFailed && !data.result ? (
                <Panel variant="brutal">
                  <PanelHeader variant="brutal">
                    <PanelTitle>Scrape failed</PanelTitle>
                  </PanelHeader>
                  <PanelContent>
                    <p className="text-sm text-muted">
                      The scrape finished with a failure state and did not return a result payload.
                    </p>
                  </PanelContent>
                </Panel>
              ) : null}

              {data.result ? <ScrapeResultViewer result={data.result} scrapeId={data.id} /> : null}
            </div>
          )}
        </DataLoader>

      </PageBody>
    </Page>
  );
}
