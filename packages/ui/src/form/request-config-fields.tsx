'use client';

import * as React from 'react';
import availableLocales from 'cldr-core/availableLocales.json';
import { rawTimeZones } from '@vvo/tzdb';
import { FileText, Plus, Search, Trash2, X } from 'lucide-react';
import type { NetworkPolicy } from '@tentacrawl/core/schema';
import { Button } from '../primitives/button';
import { Input } from '../primitives/input';
import { Label } from '../primitives/label';
import { cn } from '../lib/utils';

type FieldProps = {
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
};

type HeaderRow = {
  id: string;
  key: string;
  value: string;
};

function renderErrorBadge(error?: string) {
  if (!error) {
    return null;
  }

  return (
    <p className="inline-flex w-fit max-w-full border border-destructive bg-destructive px-2 py-1.5 text-xs font-bold leading-tight text-white shadow-[2px_2px_0_0_var(--color-ink)]">
      {error}
    </p>
  );
}

function normalizeNetworkPolicy(value: unknown): NetworkPolicy {
  if (!value || typeof value !== 'object' || !('mode' in value)) {
    return { mode: 'none' };
  }

  const candidate = value as Partial<NetworkPolicy> & {
    proxy?: { server?: string; username?: string; password?: string };
    poolId?: string;
  };

  if (candidate.mode === 'static') {
    return {
      mode: 'static',
      proxy: {
        server: candidate.proxy?.server ?? '',
        username: candidate.proxy?.username || undefined,
        password: candidate.proxy?.password || undefined,
      },
    };
  }

  if (candidate.mode === 'managed') {
    return {
      mode: 'managed',
      poolId: candidate.poolId ?? '',
    };
  }

  return { mode: 'none' };
}

function objectToRows(value: unknown): HeaderRow[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value as Record<string, string>).map(([key, entryValue], index) => ({
    id: `${key}-${index}`,
    key,
    value: entryValue,
  }));
}

function rowsToRecord(rows: HeaderRow[]) {
  const record: Record<string, string> = {};

  for (const row of rows) {
    const key = row.key.trim();
    if (!key) {
      continue;
    }
    record[key] = row.value;
  }

  return Object.keys(record).length > 0 ? record : undefined;
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort((a, b) => a.localeCompare(b));
}

function getLocaleSuggestions(): string[] {
  const candidates = Array.isArray(availableLocales.availableLocales?.full)
    ? availableLocales.availableLocales.full
    : [];

  try {
    return dedupeStrings(Intl.getCanonicalLocales(candidates));
  } catch {
    return dedupeStrings(candidates);
  }
}

function getTimezoneSuggestions(): string[] {
  return dedupeStrings(rawTimeZones.map((timezone) => timezone.name));
}

interface SearchableOptionFieldProps {
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  placeholder: string;
  options: string[];
  emptyLabel: string;
}

function SearchableOptionField({
  id,
  value,
  onChange,
  error,
  placeholder,
  options,
  emptyLabel,
}: SearchableOptionFieldProps) {
  const selectedValue = typeof value === 'string' ? value : '';
  const [query, setQuery] = React.useState(selectedValue);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setQuery(selectedValue);
  }, [selectedValue]);

  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length === 0) {
      return options.slice(0, 40);
    }

    return options
      .filter((option) => option.toLowerCase().includes(normalizedQuery))
      .slice(0, 80);
  }, [options, query]);

  const showDropdown = open && (query.trim().length > 0 || filteredOptions.length > 0);

  return (
    <div
      className="space-y-2"
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }

        setOpen(false);
        setQuery(selectedValue);
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          aria-invalid={Boolean(error)}
          className={cn('pl-9 pr-10')}
        />
        {selectedValue ? (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => {
              onChange(undefined);
              setQuery('');
              setOpen(false);
            }}
            aria-label="Clear selected value"
          >
            <X className="size-4" />
          </button>
        ) : null}

        {showDropdown ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-2 border border-ink bg-surface shadow-brutal-sm">
            {filteredOptions.length > 0 ? (
              <div className="max-h-64 overflow-y-auto py-1">
                {filteredOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                      selectedValue === option && 'bg-accent text-accent-foreground',
                    )}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onChange(option);
                      setQuery(option);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{option}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-4 text-sm text-muted-foreground">
                No matching options.
              </div>
            )}
          </div>
        ) : null}
      </div>

      {!selectedValue ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : null}
      {renderErrorBadge(error)}
    </div>
  );
}

export function LocaleField({ value, onChange, error }: FieldProps) {
  const suggestions = React.useMemo(() => getLocaleSuggestions(), []);

  return (
    <SearchableOptionField
      id="request-locale"
      value={value}
      onChange={onChange}
      error={error}
      placeholder="Search locale"
      options={suggestions}
      emptyLabel="No locale selected. The runner default locale will be used."
    />
  );
}

export function TimezoneField({ value, onChange, error }: FieldProps) {
  const suggestions = React.useMemo(() => getTimezoneSuggestions(), []);

  return (
    <SearchableOptionField
      id="request-timezone"
      value={value}
      onChange={onChange}
      error={error}
      placeholder="Search timezone"
      options={suggestions}
      emptyLabel="No timezone selected. The runner default timezone will be used."
    />
  );
}

export function NetworkPolicyField({ value, onChange, error }: FieldProps) {
  const policy = normalizeNetworkPolicy(value);

  const updatePolicy = (next: NetworkPolicy) => {
    onChange(next);
  };

  const modeOptions = [
    {
      value: 'none',
      title: 'Direct',
      description: 'Use the default network path with no proxy.',
    },
    {
      value: 'static',
      title: 'Static proxy',
      description: 'Send traffic through a single configured proxy server.',
    },
    {
      value: 'managed',
      title: 'Managed pool',
      description: 'Use a proxy pool selected by its pool identifier.',
    },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {modeOptions.map((option) => {
          const isActive = policy.mode === option.value;

          return (
            <Button
              key={option.value}
              type="button"
              variant={isActive ? 'default' : 'outline'}
              className={cn(
                'h-auto min-h-24 flex-col items-start justify-start whitespace-normal px-4 py-3 text-left',
                isActive ? 'border-foreground' : 'border-ink/20',
              )}
              onClick={() => {
                if (option.value === 'static') {
                  updatePolicy({
                    mode: 'static',
                    proxy: { server: '', username: undefined, password: undefined },
                  });
                  return;
                }

                if (option.value === 'managed') {
                  updatePolicy({ mode: 'managed', poolId: '' });
                  return;
                }

                updatePolicy({ mode: 'none' });
              }}
            >
              <span className="text-sm font-semibold">{option.title}</span>
              <span className="text-xs font-medium opacity-80">{option.description}</span>
            </Button>
          );
        })}
      </div>

      {policy.mode === 'static' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="network-policy-server">Proxy server</Label>
            <Input
              id="network-policy-server"
              placeholder="http://proxy.example:8080"
              value={policy.proxy.server}
              onChange={(event) => {
                updatePolicy({
                  mode: 'static',
                  proxy: {
                    ...policy.proxy,
                    server: event.target.value,
                  },
                });
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="network-policy-username">Username</Label>
            <Input
              id="network-policy-username"
              placeholder="Optional"
              value={policy.proxy.username ?? ''}
              onChange={(event) => {
                updatePolicy({
                  mode: 'static',
                  proxy: {
                    ...policy.proxy,
                    username: event.target.value || undefined,
                  },
                });
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="network-policy-password">Password</Label>
            <Input
              id="network-policy-password"
              type="password"
              placeholder="Optional"
              value={policy.proxy.password ?? ''}
              onChange={(event) => {
                updatePolicy({
                  mode: 'static',
                  proxy: {
                    ...policy.proxy,
                    password: event.target.value || undefined,
                  },
                });
              }}
            />
          </div>
        </div>
      ) : null}

      {policy.mode === 'managed' ? (
        <div className="space-y-2">
          <Label htmlFor="network-policy-pool">Pool ID</Label>
          <Input
            id="network-policy-pool"
            placeholder="proxy-pool-id"
            value={policy.poolId}
            onChange={(event) => {
              updatePolicy({
                mode: 'managed',
                poolId: event.target.value,
              });
            }}
          />
        </div>
      ) : null}
      {renderErrorBadge(error)}
    </div>
  );
}

export function HeaderMapField({ value, onChange, error }: FieldProps) {
  const [rows, setRows] = React.useState<HeaderRow[]>(() => objectToRows(value));
  const serializedValue = React.useMemo(() => JSON.stringify(value ?? {}), [value]);

  React.useEffect(() => {
    setRows(objectToRows(value));
  }, [serializedValue, value]);

  const updateRows = (next: HeaderRow[]) => {
    setRows(next);
    onChange(rowsToRecord(next));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Request headers</p>
          <p className="text-xs text-muted-foreground">
            Attach optional HTTP headers only when the target site needs them.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => updateRows([...rows, { id: crypto.randomUUID(), key: '', value: '' }])}
        >
          <Plus className="size-4" />
          Add header
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-32 flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
          <FileText className="size-5" />
          <span>No custom headers configured.</span>
        </div>
      ) : (
        <div className="min-h-32 space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <Input
                placeholder="Header name"
                value={row.key}
                onChange={(event) => {
                  updateRows(
                    rows.map((entry) => (
                      entry.id === row.id ? { ...entry, key: event.target.value } : entry
                    )),
                  );
                }}
              />
              <Input
                placeholder="Header value"
                value={row.value}
                onChange={(event) => {
                  updateRows(
                    rows.map((entry) => (
                      entry.id === row.id ? { ...entry, value: event.target.value } : entry
                    )),
                  );
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => updateRows(rows.filter((entry) => entry.id !== row.id))}
                aria-label="Remove header"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {renderErrorBadge(error)}
    </div>
  );
}