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
} from '@tentacrawl/ui';
import { Compass, Route, ShieldCheck } from 'lucide-react';
import type { CreateCrawlDto } from '../../../../data/schemas';
import {
  createCrawlFormSchema,
  crawlFormFields as fields,
  crawlFormGroups as groups,
  crawlFormInitialValues as initialValues,
} from '../../../components/form-config';
import { useCreateCrawl } from '../../../hooks/use-crawls';

export function CrawlCreatePage() {
  const router = useRouter();
  const createCrawl = useCreateCrawl();

  async function handleSubmit(values: Record<string, unknown>) {
    const result = await createCrawl.mutateAsync(values as CreateCrawlDto);
    router.push(`/crawl/${result.id}`);
  }

  return (
    <Page>
      <PageHeader
        title="New Crawl"
        description="Define the crawl seed, scope limits, frontier filters, and per-page artefacts before enqueuing the run."
      />
      <PageBody>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Panel variant="brutal" className="h-fit max-w-3xl">
            <PanelContent>
              <CrudForm
                fields={fields}
                groups={groups}
                schema={createCrawlFormSchema}
                initialValues={initialValues}
                onSubmit={handleSubmit}
                submitLabel="Queue Crawl"
                isSubmitting={createCrawl.isPending}
              />
            </PanelContent>
          </Panel>

          <div className="space-y-4">
            <Panel variant="brutal">
              <PanelHeader variant="brutal">
                <PanelTitle>How This Crawl Runs</PanelTitle>
              </PanelHeader>
              <PanelContent className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <Compass className="mt-0.5 size-4 text-brand" />
                  <div>
                    <p className="font-semibold">The seed URL is only the starting point</p>
                    <p className="text-muted">
                      The crawler expands from the first page by following discovered links until it hits the depth or page-count limits you configured.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Route className="mt-0.5 size-4 text-brand" />
                  <div>
                    <p className="font-semibold">Regex filters shape the frontier</p>
                    <p className="text-muted">
                      Use include and exclude patterns to keep the crawl on the right sections of the site and avoid account, cart, or other irrelevant paths.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-4 text-brand" />
                  <div>
                    <p className="font-semibold">Scope limits protect the queue</p>
                    <p className="text-muted">
                      Depth and max-pages are hard guardrails. Set them intentionally so broad sites do not overwhelm storage, execution time, or downstream review.
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