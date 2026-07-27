'use client';

import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Badge,
  DataLoader,
  DataTable,
  EmptyState,
  Page,
  PageBody,
  PageHeader,
  Switch,
} from '@tentacrawl/ui';
import { Puzzle } from 'lucide-react';
import type { ChallengerListItem } from '../../../data/schemas';
import {
  useChallengers,
  useSetChallengerEnabled,
} from '../../hooks/use-challengers';

export function ChallengerListPage() {
  const router = useRouter();
  const { data, isLoading, error } = useChallengers();
  const setEnabled = useSetChallengerEnabled();

  const columns: ColumnDef<ChallengerListItem>[] = [
    {
      accessorKey: 'id',
      header: 'Extension',
      cell: ({ row }) => (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{row.original.id}</p>
          <p className="font-mono text-xs text-muted-foreground">v{row.original.version}</p>
        </div>
      ),
    },
    {
      accessorKey: 'capabilities',
      header: 'Capabilities',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.capabilities.map((cap) => (
            <Badge key={cap} variant="outline" className="text-xs">
              {cap}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      accessorKey: 'targets',
      header: 'Targets',
      cell: ({ row }) => {
        const targets = row.original.targets ?? [];
        if (targets.length === 0) {
          return <span className="text-xs text-muted-foreground">all runs</span>;
        }
        const hosts = targets.flatMap((t) => t.hostnames ?? []);
        return (
          <span className="font-mono text-xs text-muted-foreground">
            {hosts.length > 0 ? hosts.join(', ') : `${targets.length} rule(s)`}
          </span>
        );
      },
    },
    {
      accessorKey: 'signalCount',
      header: 'Signals',
      cell: ({ row }) => (
        <div className="space-y-1 text-sm">
          <p className="font-mono text-xs font-bold text-foreground">{row.original.signalCount}</p>
          {row.original.lastError ? (
            <p className="truncate text-xs text-destructive" title={row.original.lastError}>
              last error
            </p>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.status === 'archived' ? (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            archived
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            active
          </Badge>
        ),
    },
    {
      accessorKey: 'enabled',
      header: 'Enabled',
      cell: ({ row }) => {
        const archived = row.original.status === 'archived';
        return (
          <div onClick={(event) => event.stopPropagation()}>
            <Switch
              checked={row.original.enabled && !archived}
              disabled={setEnabled.isPending || archived}
              onCheckedChange={(checked) =>
                setEnabled.mutate({ id: row.original.id, enabled: checked })
              }
            />
          </div>
        );
      },
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Extensions"
        description={
          data
            ? `${data.length} challenger extension${data.length === 1 ? '' : 's'} registered.`
            : 'Installed challenger extensions'
        }
      />
      <PageBody>
        <DataLoader isLoading={isLoading} error={error}>
          {data && data.length === 0 ? (
            <EmptyState
              icon={<Puzzle className="h-10 w-10" />}
              title="No Extensions Registered"
              description="Challenger extensions appear here once their module is enabled in modules.config.ts and the worker has started."
              className="min-h-[280px] border-0 bg-transparent px-0 py-12 shadow-none"
            />
          ) : (
            <DataTable
              columns={columns}
              data={data ?? []}
              isLoading={isLoading}
              onRowClick={(row) =>
                router.push(`/extensions/${encodeURIComponent(row.id)}`)
              }
            />
          )}
        </DataLoader>
      </PageBody>
    </Page>
  );
}
