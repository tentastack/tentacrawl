'use client';

import { useRouter } from 'next/navigation';
import {
  Page,
  PageHeader,
  PageBody,
  CrudForm,
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from '@tentacrawl/ui';
import { Bot, FileSearch, Route } from 'lucide-react';
import {
  createScrapeFormSchema,
  scrapeFormFields as fields,
  scrapeFormGroups as groups,
  scrapeFormInitialValues as initialValues,
} from '../../../components/form-config';
import { useCreateScrape } from '../../../hooks/use-scrapes';
import type { CreateScrapeDto } from '../../../../data/schemas';

export function ScrapeCreatePage() {
  const router = useRouter();
  const createScrape = useCreateScrape();

  async function handleSubmit(values: Record<string, unknown>) {
    const result = await createScrape.mutateAsync(values as CreateScrapeDto);
    router.push(`/scrape/${result.id}`);
  }

  return (
    <Page>
      <PageHeader
        title="New Scrape"
        description="Configure and launch a single-page scrape with a step-by-step form layout."
      />
      <PageBody>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Panel variant="brutal" className="h-fit max-w-3xl">
            <PanelContent>
              <CrudForm
                fields={fields}
                groups={groups}
                schema={createScrapeFormSchema}
                initialValues={initialValues}
                onSubmit={handleSubmit}
                submitLabel="Start Scrape"
                isSubmitting={createScrape.isPending}
              />
            </PanelContent>
          </Panel>

          <div className="space-y-4">
            <Panel variant="brutal">
              <PanelHeader variant="brutal">
                <PanelTitle>Why Run A Scrape</PanelTitle>
              </PanelHeader>
              <PanelContent className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <Bot className="mt-0.5 size-4 text-brand" />
                  <div>
                    <p className="font-semibold">Rendered content, not just raw HTML</p>
                    <p className="text-muted">
                      Use a scrape when you want the page content after browser execution, including client-side rendering, delayed requests, and common anti-bot friction.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileSearch className="mt-0.5 size-4 text-brand" />
                  <div>
                    <p className="font-semibold">Good default for one page</p>
                    <p className="text-muted">
                      Start here when you need content, links, metadata, screenshots, or structured extraction from a single URL without building a bigger workflow.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Route className="mt-0.5 size-4 text-brand" />
                  <div>
                    <p className="font-semibold">Escalate to DSL for multi-step journeys</p>
                    <p className="text-muted">
                      If the target requires consent clicks, login, pagination, tab switching, or other navigation logic, add DSL instructions and run an advanced multi-step scrape.
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
