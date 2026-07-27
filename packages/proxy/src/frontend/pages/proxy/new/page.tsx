'use client';

import { useRouter } from 'next/navigation';
import {
  CrudForm,
  Page,
  PageBody,
  PageHeader,
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
  flash,
} from '@tentacrawl/ui';
import { Activity, KeyRound, Network } from 'lucide-react';
import {
  buildProxyServerFormFields,
  formValuesToServer,
  proxyServerFormGroups,
  proxyServerFormSchema,
  validateEndpointsBeforeSave,
} from '../../../components/form-config';
import { useCreateProxyServer, useTestProxyEndpoint } from '../../../hooks/use-proxy-servers';

export function ProxyServerCreatePage() {
  const router = useRouter();
  const createServer = useCreateProxyServer();
  const testEndpoint = useTestProxyEndpoint();

  async function handleSubmit(values: Record<string, unknown>) {
    const server = formValuesToServer(values);
    const validationError = await validateEndpointsBeforeSave(server, (input) =>
      testEndpoint.mutateAsync(input),
    );
    if (validationError) {
      flash(validationError, 'error');
      return;
    }
    const result = await createServer.mutateAsync(server);
    router.push(`/proxy/${result.id}`);
  }

  return (
    <Page>
      <PageHeader
        title="New Proxy Server"
        description="Define a proxy server with one or more endpoints that managed network policies can route through."
      />
      <PageBody>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Panel variant="brutal" className="h-fit max-w-3xl">
            <PanelContent>
              <CrudForm
                fields={buildProxyServerFormFields()}
                groups={proxyServerFormGroups}
                schema={proxyServerFormSchema}
                onSubmit={handleSubmit}
                submitLabel="Create Server"
                isSubmitting={createServer.isPending || testEndpoint.isPending}
              />
            </PanelContent>
          </Panel>

          <div className="space-y-4">
            <Panel variant="brutal">
              <PanelHeader variant="brutal">
                <PanelTitle>How Proxy Servers Work</PanelTitle>
              </PanelHeader>
              <PanelContent className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <Network className="mt-0.5 size-4 text-brand" />
                  <div>
                    <p className="font-semibold">Endpoints share credentials</p>
                    <p className="text-muted">
                      A server is one set of credentials with one or more gateway URLs. Add every endpoint your provider hands out; rotation spreads runs across them.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <KeyRound className="mt-0.5 size-4 text-brand" />
                  <div>
                    <p className="font-semibold">Runs pick servers via network policy</p>
                    <p className="text-muted">
                      Scrapes and crawls with a managed network policy reference the proxy extension and optionally a specific server. Auto mode rotates across all enabled servers.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Activity className="mt-0.5 size-4 text-brand" />
                  <div>
                    <p className="font-semibold">Usage is tracked per endpoint</p>
                    <p className="text-muted">
                      Every run records the endpoint it used and its outcome, so you can spot unhealthy endpoints and remove them.
                    </p>
                  </div>
                </div>
              </PanelContent>
            </Panel>
          </div>
        </div>
      </PageBody>
    </Page>
  );
}
