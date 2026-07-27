'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  CrudForm,
  DataLoader,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Page,
  PageBody,
  PageHeader,
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  flash,
  timeAgo,
} from '@tentacrawl/ui';
import { ArrowLeft, Trash2 } from 'lucide-react';
import {
  buildProxyServerFormFields,
  formValuesToServer,
  proxyServerFormGroups,
  proxyServerFormSchema,
  serverToFormValues,
  shouldValidateBeforeSave,
  validateEndpointsBeforeSave,
} from '../../../components/form-config';
import { ProxyOutcomeBadge } from '../../../components/proxy-outcome-badge';
import {
  useDeleteProxyServer,
  useProxyServer,
  useProxyServerUsage,
  useTestProxyEndpoint,
  useUpdateProxyServer,
  type ProxyEndpointItem,
  type ProxyUsageItem,
} from '../../../hooks/use-proxy-servers';

function endpointSuccessRate(endpoint: ProxyEndpointItem): string {
  const settled = endpoint.timesSucceeded + endpoint.timesFailed;
  if (settled === 0) return '-';
  return `${Math.round((endpoint.timesSucceeded / settled) * 100)}%`;
}

// taskId for a 'scrape' task is the scrape's own id; for a 'crawl-page' task
// it's the individual page id, so the crawl detail page needs correlationId instead
function resolveTaskHref(entry: Pick<ProxyUsageItem, 'taskType' | 'taskId' | 'correlationId'>): string | undefined {
  if (entry.taskType === 'scrape') return `/scrape/${entry.taskId}`;
  if (entry.taskType === 'crawl-page') return entry.correlationId ? `/crawl/${entry.correlationId}` : undefined;
  return undefined;
}

export function ProxyServerDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const { data: server, isLoading, error } = useProxyServer(id);
  const { data: usage } = useProxyServerUsage(id);
  const updateServer = useUpdateProxyServer();
  const deleteServer = useDeleteProxyServer();
  const testEndpoint = useTestProxyEndpoint();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorEndpoint, setErrorEndpoint] = useState<ProxyEndpointItem | null>(null);

  async function handleSubmit(values: Record<string, unknown>) {
    const updated = formValuesToServer(values);
    if (server && shouldValidateBeforeSave(values, serverToFormValues(server))) {
      const validationError = await validateEndpointsBeforeSave(
        updated,
        (input) => testEndpoint.mutateAsync(input),
        id,
      );
      if (validationError) {
        flash(validationError, 'error');
        return;
      }
    }
    await updateServer.mutateAsync({ id, ...updated });
  }

  return (
    <Page>
      <PageHeader title="Proxy Server" description={server?.name ?? id}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push('/proxy')}>
            <ArrowLeft className="mr-2 h-3.5 w-3.5" />
            Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={deleteServer.isPending}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </PageHeader>
      <PageBody>
        <DataLoader isLoading={isLoading} error={error}>
          {server && (
            <div className="space-y-6">
              <Panel variant="brutal">
                <PanelHeader variant="brutal">
                  <PanelTitle>Configuration</PanelTitle>
                </PanelHeader>
                <PanelContent>
                  <CrudForm
                    fields={buildProxyServerFormFields(id)}
                    groups={proxyServerFormGroups}
                    schema={proxyServerFormSchema}
                    initialValues={serverToFormValues(server)}
                    onSubmit={handleSubmit}
                    submitLabel="Save Changes"
                    isSubmitting={updateServer.isPending || testEndpoint.isPending}
                  />
                </PanelContent>
              </Panel>

              <Panel variant="brutal">
                <PanelHeader variant="brutal">
                  <PanelTitle>Endpoint Health</PanelTitle>
                </PanelHeader>
                <PanelContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Uses</TableHead>
                        <TableHead>Succeeded</TableHead>
                        <TableHead>Failed</TableHead>
                        <TableHead>Success Rate</TableHead>
                        <TableHead>Last Used</TableHead>
                        <TableHead>Last Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {server.endpoints.map((endpoint) => (
                        <TableRow key={endpoint.id}>
                          <TableCell className="font-mono text-xs">{endpoint.url}</TableCell>
                          <TableCell>{endpoint.timesUsed}</TableCell>
                          <TableCell>{endpoint.timesSucceeded}</TableCell>
                          <TableCell>{endpoint.timesFailed}</TableCell>
                          <TableCell
                            className={
                              endpoint.timesSucceeded + endpoint.timesFailed === 0
                                ? 'text-muted-foreground'
                                : undefined
                            }
                          >
                            {endpointSuccessRate(endpoint)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {endpoint.lastUsedAt ? timeAgo(endpoint.lastUsedAt) : '-'}
                          </TableCell>
                          <TableCell className="max-w-56 font-mono text-xs text-muted-foreground">
                            {endpoint.lastError ? (
                              <button
                                type="button"
                                onClick={() => setErrorEndpoint(endpoint)}
                                className="block max-w-56 truncate text-left text-destructive underline-offset-2 hover:underline"
                              >
                                {endpoint.lastError}
                              </button>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </PanelContent>
              </Panel>

              <Panel variant="brutal">
                <PanelHeader variant="brutal">
                  <PanelTitle>Recent Usage</PanelTitle>
                </PanelHeader>
                <PanelContent>
                  {usage && usage.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Started</TableHead>
                          <TableHead>Task</TableHead>
                          <TableHead>Endpoint</TableHead>
                          <TableHead>Outcome</TableHead>
                          <TableHead>Duration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usage.map((entry) => {
                          const taskHref = resolveTaskHref(entry);
                          return (
                            <TableRow key={entry.id}>
                              <TableCell className="text-xs text-muted-foreground">
                                {timeAgo(entry.startedAt)}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {taskHref ? (
                                  <Link href={taskHref} className="text-brand hover:underline">
                                    {entry.taskType} / {entry.taskId}
                                  </Link>
                                ) : (
                                  `${entry.taskType} / ${entry.taskId}`
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{entry.endpointUrl}</TableCell>
                              <TableCell>
                                <ProxyOutcomeBadge outcome={entry.outcome} />
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {entry.durationMs != null ? `${entry.durationMs} ms` : '-'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No runs have used this server yet.
                    </p>
                  )}
                </PanelContent>
              </Panel>
            </div>
          )}
        </DataLoader>

        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Proxy Server?</DialogTitle>
              <DialogDescription>
                {server
                  ? `This will delete "${server.name}" and its endpoint statistics. Tasks referencing it in a managed network policy will fall back to a direct connection.`
                  : 'This will delete the selected server.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(false)}
                disabled={deleteServer.isPending}
              >
                Keep Server
              </Button>
              <Button
                variant="destructive"
                disabled={deleteServer.isPending}
                onClick={() => {
                  deleteServer.mutate(id, {
                    onSuccess: () => router.push('/proxy'),
                    onSettled: () => setConfirmDelete(false),
                  });
                }}
              >
                Confirm Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!errorEndpoint} onOpenChange={(open) => !open && setErrorEndpoint(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Endpoint Error</DialogTitle>
              <DialogDescription>
                {errorEndpoint?.url}
                {errorEndpoint?.lastFailedAt ? ` · ${timeAgo(errorEndpoint.lastFailedAt)}` : ''}
              </DialogDescription>
            </DialogHeader>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words border border-ink bg-surface p-3 font-mono text-xs">
              {errorEndpoint?.lastError}
            </pre>
            <DialogFooter>
              <Button variant="outline" onClick={() => setErrorEndpoint(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageBody>
    </Page>
  );
}
