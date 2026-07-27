import * as React from 'react';
import { z } from 'zod';
import { CountryField, type CrudField, type CrudFormGroup } from '@tentacrawl/ui';
import { proxyEndpointUrlSchema } from '../../data/schemas';
import { AddEndpointButton, EndpointListField } from './endpoint-list-field';
import type {
  ProxyServerItem,
  ProxyValidationResult,
  SaveProxyServerInput,
  TestProxyEndpointInput,
} from '../hooks/use-proxy-servers';

export const proxyServerFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  enabled: z.boolean(),
  location: z
    .string()
    .regex(/^[A-Z]{2}$/, 'Pick a country from the list')
    .optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  notes: z.string().optional(),
  endpoints: z
    .array(
      z.object({
        id: z.string().optional(),
        url: proxyEndpointUrlSchema,
      }),
    )
    .min(1, 'Add at least one endpoint'),
});

// serverId is set for the edit page so EndpointListField can ask the backend
// to fall back to the stored password when testing with a blank password field
export function buildProxyServerFormFields(serverId?: string): CrudField[] {
  return [
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      required: true,
      fullWidth: true,
      placeholder: 'eu-residential',
      description: 'Shown when picking a proxy in scrape and crawl network policies.',
    },
    {
      name: 'enabled',
      label: 'Enabled',
      type: 'switch',
      defaultValue: true,
      description: 'Disabled servers are never selected for runs.',
    },
    {
      name: 'location',
      label: 'Location',
      type: 'custom',
      render: ({ value, onChange, error }) =>
        React.createElement(CountryField, {
          value,
          onChange,
          error,
          emptyLabel: 'No location set. The server is treated as location-agnostic.',
        }),
    },
    {
      name: 'endpoints',
      label: 'Endpoints',
      hideLabel: true,
      type: 'custom',
      defaultValue: [{ url: '' }],
      description:
        'Scheme is optional. "gw1.example:8080" is treated as an HTTP proxy; use "socks5://" for SOCKS5.',
      render: ({ value, onChange, error, values }) =>
        React.createElement(EndpointListField, {
          value,
          onChange,
          error,
          username: values?.username as string | undefined,
          password: values?.password as string | undefined,
          serverId,
        }),
      headerAction: ({ value, onChange }) =>
        React.createElement(AddEndpointButton, { value, onChange }),
    },
    {
      name: 'username',
      label: 'Username',
      type: 'text',
      placeholder: 'Optional',
    },
    {
      name: 'password',
      label: 'Password',
      type: 'password',
      placeholder: 'Optional',
      description: serverId
        ? 'Never shown after saving. Leave blank to keep the current password — testing without retyping it uses the saved one.'
        : 'Optional. Required by most providers alongside a username.',
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
      placeholder: 'Provider, region, contract details...',
    },
  ];
}

export const proxyServerFormGroups: CrudFormGroup[] = [
  {
    title: 'Identity',
    description: 'Name the server, set its exit location, and control whether runs may use it.',
    fields: ['name', 'enabled', 'location'],
  },
  {
    title: 'Endpoints',
    description: 'One or more gateway URLs sharing the same credentials.',
    fields: ['endpoints'],
  },
  {
    title: 'Credentials and notes',
    description: 'Credentials apply to all endpoints. Notes are free text for operators.',
    fields: ['username', 'password', 'notes'],
  },
];

export function serverToFormValues(server: ProxyServerItem): Record<string, unknown> {
  return {
    name: server.name,
    enabled: server.enabled,
    location: server.location,
    username: server.username ?? '',
    password: '', // blank means keep the stored password
    notes: server.notes ?? '',
    endpoints: server.endpoints.map((endpoint) => ({ id: endpoint.id, url: endpoint.url })),
  };
}

export function formValuesToServer(values: Record<string, unknown>): SaveProxyServerInput {
  const username = (values.username as string | undefined)?.trim();
  const password = (values.password as string | undefined)?.trim();
  const notes = (values.notes as string | undefined)?.trim();
  return {
    name: values.name as string,
    enabled: Boolean(values.enabled),
    location: (values.location as string | undefined) || undefined,
    username: username || undefined,
    password: password || undefined,
    notes: notes || undefined,
    endpoints: (values.endpoints as Array<{ id?: string; url: string }>).map((e) => ({
      id: e.id,
      url: e.url.trim(),
    })),
  };
}

// Skips the extra round-trip on saves that don't touch anything
// proxy-relevant (renaming, toggling enabled, editing notes, ...).
export function shouldValidateBeforeSave(
  values: Record<string, unknown>,
  initialValues?: Record<string, unknown>,
): boolean {
  if (!initialValues) return true; // creating a new server: always safe to test

  const passwordTyped = Boolean((values.password as string | undefined)?.trim());
  if (passwordTyped) return true;

  const usernameChanged =
    ((values.username as string | undefined) ?? '') !==
    ((initialValues.username as string | undefined) ?? '');
  if (usernameChanged) return true;

  const currentEndpoints = (values.endpoints as Array<{ url: string }>) ?? [];
  const initialEndpoints = (initialValues.endpoints as Array<{ url: string }>) ?? [];
  if (currentEndpoints.length !== initialEndpoints.length) return true;
  return currentEndpoints.some(
    (endpoint, index) => endpoint.url.trim() !== initialEndpoints[index]?.url.trim(),
  );
}

// Tests every endpoint with the form's current credentials; returns a
// human-readable message for the first failure, or null when all pass.
// serverId lets the backend fall back to the stored password when it's blank.
export async function validateEndpointsBeforeSave(
  server: Pick<SaveProxyServerInput, 'endpoints' | 'username' | 'password'>,
  test: (input: TestProxyEndpointInput) => Promise<ProxyValidationResult>,
  serverId?: string,
): Promise<string | null> {
  const outcomes = await Promise.all(
    server.endpoints.map(async (endpoint) => {
      try {
        const result = await test({
          url: endpoint.url,
          username: server.username,
          password: server.password,
          serverId,
        });
        return { url: endpoint.url, ok: result.ok, error: result.error };
      } catch (err) {
        return {
          url: endpoint.url,
          ok: false,
          error: err instanceof Error ? err.message : 'Validation failed',
        };
      }
    }),
  );

  const failure = outcomes.find((outcome) => !outcome.ok);
  return failure ? `${failure.url} failed validation: ${failure.error ?? 'unknown error'}` : null;
}
