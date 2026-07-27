'use client';

import * as React from 'react';
import { CheckCircle2, Plus, Server, Trash2, XCircle, Zap } from 'lucide-react';
import { Button, Input, Spinner } from '@tentacrawl/ui';
import {
  useTestProxyEndpoint,
  type ProxyValidationDetails,
} from '../hooks/use-proxy-servers';

type EndpointValue = { id?: string; url: string };

type EndpointRow = EndpointValue & { rowId: string };

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'success'; details?: ProxyValidationDetails }
  | { status: 'error'; message: string };

const IDLE_STATE: TestState = { status: 'idle' };

function valueToRows(value: unknown): EndpointRow[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return (value as EndpointValue[]).map((entry, index) => ({
    rowId: entry.id ?? `row-${index}`,
    id: entry.id,
    url: entry.url ?? '',
  }));
}

function rowsToValue(rows: EndpointRow[]): EndpointValue[] {
  return rows.map(({ id, url }) => (id ? { id, url } : { url }));
}

function formatDetails(details?: ProxyValidationDetails): string {
  if (!details) return 'Proxy responded';
  const place = [details.city, details.region, details.country].filter(Boolean).join(', ');
  const parts = [details.ip, place || undefined, `${details.latencyMs} ms`].filter(Boolean);
  return parts.join(' · ');
}

export function AddEndpointButton({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        const current = Array.isArray(value) ? (value as EndpointValue[]) : [];
        onChange([...current, { url: '' }]);
      }}
    >
      <Plus className="size-4" />
      Add endpoint
    </Button>
  );
}

export function EndpointListField({
  value,
  onChange,
  error,
  username,
  password,
  serverId,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  username?: string;
  password?: string;
  // set on the edit page; lets the backend fall back to the saved password
  serverId?: string;
}) {
  const [rows, setRows] = React.useState<EndpointRow[]>(() => valueToRows(value));
  const serializedValue = React.useMemo(() => JSON.stringify(value ?? []), [value]);
  const [pendingFocusId, setPendingFocusId] = React.useState<string | null>(null);
  const inputRefs = React.useRef(new Map<string, HTMLInputElement | null>());
  const [testStates, setTestStates] = React.useState<Record<string, TestState>>({});
  const testEndpoint = useTestProxyEndpoint();

  React.useEffect(() => {
    setRows(valueToRows(value));
  }, [serializedValue, value]);

  React.useEffect(() => {
    if (pendingFocusId) {
      inputRefs.current.get(pendingFocusId)?.focus();
      setPendingFocusId(null);
    }
  }, [pendingFocusId, rows]);

  const updateRows = (next: EndpointRow[]) => {
    setRows(next);
    onChange(rowsToValue(next));
  };

  const addEndpoint = () => {
    const newRowId = `row-${rows.length}`;
    updateRows([...rows, { rowId: newRowId, url: '' }]);
    setPendingFocusId(newRowId);
  };

  const runTest = async (row: EndpointRow) => {
    const url = row.url.trim();
    if (!url) return;

    // for a brand-new (unsaved) server there's no stored password to fall
    // back to, so a blank password with a username set can't be tested
    if (!serverId && username?.trim() && !password?.trim()) {
      setTestStates((prev) => ({
        ...prev,
        [row.rowId]: {
          status: 'error',
          message: 'Enter the password above to test this endpoint.',
        },
      }));
      return;
    }

    setTestStates((prev) => ({ ...prev, [row.rowId]: { status: 'testing' } }));
    try {
      const result = await testEndpoint.mutateAsync({ url, username, password, serverId });
      setTestStates((prev) => ({
        ...prev,
        [row.rowId]: result.ok
          ? { status: 'success', details: result.details }
          : { status: 'error', message: result.error ?? 'Validation failed' },
      }));
    } catch (err) {
      setTestStates((prev) => ({
        ...prev,
        [row.rowId]: {
          status: 'error',
          message: err instanceof Error ? err.message : 'Validation failed',
        },
      }));
    }
  };

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <div className="flex min-h-24 flex-col items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
          <Server className="size-5" />
          <span>No endpoints yet. Add at least one.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const testState = testStates[row.rowId] ?? IDLE_STATE;
            return (
              <div key={row.rowId} className="space-y-1.5">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <Input
                    ref={(el) => {
                      inputRefs.current.set(row.rowId, el);
                    }}
                    placeholder="gw1.example:8080 or http://gw1.example:8080"
                    value={row.url}
                    onChange={(event) => {
                      const url = event.target.value;
                      updateRows(
                        rows.map((entry) =>
                          entry.rowId === row.rowId ? { ...entry, url } : entry,
                        ),
                      );
                      setTestStates((prev) => ({ ...prev, [row.rowId]: IDLE_STATE }));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addEndpoint();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!row.url.trim() || testState.status === 'testing'}
                    onClick={() => runTest(row)}
                  >
                    {testState.status === 'testing' ? (
                      <Spinner className="size-4" />
                    ) : (
                      <Zap className="size-4" />
                    )}
                    Test
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={rows.length === 1}
                    onClick={() => {
                      updateRows(rows.filter((entry) => entry.rowId !== row.rowId));
                      setTestStates((prev) => {
                        const next = { ...prev };
                        delete next[row.rowId];
                        return next;
                      });
                    }}
                    aria-label="Remove endpoint"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {testState.status === 'success' ? (
                  <p className="flex items-center gap-1.5 font-mono text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5 shrink-0" />
                    {formatDetails(testState.details)}
                  </p>
                ) : null}
                {testState.status === 'error' ? (
                  <p className="flex items-center gap-1.5 font-mono text-xs text-destructive">
                    <XCircle className="size-3.5 shrink-0" />
                    {testState.message}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {error ? (
        <p className="inline-flex w-fit max-w-full border border-destructive bg-destructive px-2 py-1.5 text-xs font-bold leading-tight text-white shadow-[2px_2px_0_0_var(--color-ink)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
