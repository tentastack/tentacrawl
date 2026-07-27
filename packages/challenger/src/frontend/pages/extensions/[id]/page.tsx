'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
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
  StatCard,
  Switch,
} from '@tentacrawl/ui';
import { Activity, AlertTriangle, ArrowLeft, Puzzle, Trash2 } from 'lucide-react';
import {
  useChallenger,
  useChallengerSignals,
  usePurgeChallenger,
  useSetChallengerEnabled,
} from '../../../hooks/use-challengers';

export function ChallengerDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const { data, isLoading, error } = useChallenger(id);
  const { data: signals } = useChallengerSignals(id);
  const setEnabled = useSetChallengerEnabled();
  const purge = usePurgeChallenger();
  const [confirmPurge, setConfirmPurge] = useState(false);
  const archived = data?.status === 'archived';

  return (
    <Page>
      <PageHeader title="Extension Detail" description={id}>
        {archived ? (
          <Button
            variant="destructive"
            size="sm"
            disabled={purge.isPending}
            onClick={() => setConfirmPurge(true)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Purge
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => router.push('/extensions')}>
          <ArrowLeft className="mr-2 h-3.5 w-3.5" />
          Back
        </Button>
      </PageHeader>
      <PageBody>
        <DataLoader isLoading={isLoading} error={error}>
          {data && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Module" value={data.moduleId} icon={Puzzle} variant="brutal" />
                <StatCard label="Version" value={data.version} icon={Activity} variant="brutal" />
                <StatCard label="Signals" value={data.signalCount} icon={Activity} variant="brutal" />
                <StatCard
                  label="Last Error"
                  value={data.lastError ? 'Yes' : 'None'}
                  icon={AlertTriangle}
                  variant="brutal"
                />
              </div>

              <Panel>
                <PanelHeader className="flex items-center justify-between">
                  <PanelTitle>Status</PanelTitle>
                  <div className="flex items-center gap-3">
                    {archived ? (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        archived
                      </Badge>
                    ) : null}
                    <span className="text-sm text-muted-foreground">
                      {archived ? 'Not loaded' : data.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch
                      checked={data.enabled && !archived}
                      disabled={setEnabled.isPending || archived}
                      onCheckedChange={(checked) =>
                        setEnabled.mutate({ id: data.id, enabled: checked })
                      }
                    />
                  </div>
                </PanelHeader>
                <PanelContent className="space-y-3">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Capabilities</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {data.capabilities.map((cap) => (
                        <Badge key={cap} variant="outline" className="text-xs">
                          {cap}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {data.lastError ? (
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Last Error</p>
                      <p className="mt-1 font-mono text-xs text-destructive">{data.lastError}</p>
                    </div>
                  ) : null}
                </PanelContent>
              </Panel>

              <Panel>
                <PanelHeader>
                  <PanelTitle>Recent Signals</PanelTitle>
                </PanelHeader>
                <PanelContent>
                  {signals && signals.length > 0 ? (
                    <ul className="divide-y divide-border">
                      {signals.map((signal) => (
                        <li key={signal.id} className="flex items-center justify-between py-2">
                          <div className="space-y-0.5">
                            <p className="font-mono text-xs text-foreground">{signal.signalType}</p>
                            <p className="text-xs text-muted-foreground">{signal.taskId}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge
                              variant={signal.severity === 'error' ? 'destructive' : 'outline'}
                              className="text-xs"
                            >
                              {signal.severity}
                            </Badge>
                            <span className="font-mono text-xs text-muted-foreground">
                              {new Date(signal.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No signals recorded for this extension yet.
                    </p>
                  )}
                </PanelContent>
              </Panel>
            </div>
          )}
        </DataLoader>

        <Dialog open={confirmPurge} onOpenChange={setConfirmPurge}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Purge Extension?</DialogTitle>
              <DialogDescription>
                This permanently deletes the registration, stored configuration
                (including any secrets), and signal history for &quot;{id}&quot;.
                This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmPurge(false)}
                disabled={purge.isPending}
              >
                Keep Extension
              </Button>
              <Button
                variant="destructive"
                disabled={purge.isPending}
                onClick={() => {
                  purge.mutate(id, {
                    onSuccess: () => router.push('/extensions'),
                    onSettled: () => setConfirmPurge(false),
                  });
                }}
              >
                Confirm Purge
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageBody>
    </Page>
  );
}
