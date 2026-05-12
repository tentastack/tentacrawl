'use client';

import * as React from 'react';
import {
  ArtefactViewer,
  CodeBlock,
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
  formatRunEnvironment,
} from '@tentacrawl/ui';
import type { CrawlPageResponse } from '../../data/schemas';

export function CrawlPageResultViewer({ page }: { page: CrawlPageResponse }) {
  const result = page.result;
  const formattedEnvironment = React.useMemo(() => (result?.env ? formatRunEnvironment(result.env) : null), [result?.env]);

  if (!result) {
    return (
      <Panel variant="brutal">
        <PanelHeader variant="brutal">
          <PanelTitle>Page result</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <p className="text-sm text-muted-foreground">
            This page does not have a stored result payload yet.
          </p>
        </PanelContent>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {result.error ? (
        <Panel variant="brutal">
          <PanelHeader variant="brutal">
            <PanelTitle>Execution error</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <CodeBlock code={result.error} tone="error" viewportClassName="max-h-[240px]" />
          </PanelContent>
        </Panel>
      ) : null}

      <ArtefactViewer
        artefacts={result.artefacts}
        discoveredUrls={result.discoveredUrls}
        screenshotAlt="Crawl page screenshot"
        screenshotDownloadName={`${page.id}.png`}
      />

      {formattedEnvironment ? (
        <Panel variant="brutal">
          <PanelHeader variant="brutal">
            <PanelTitle>Environment</PanelTitle>
          </PanelHeader>
          <PanelContent className="min-w-0">
            <CodeBlock code={formattedEnvironment} copyable viewportClassName="max-h-[240px]" />
          </PanelContent>
        </Panel>
      ) : null}
    </div>
  );
}