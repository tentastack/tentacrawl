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
import type { ScrapeResult } from '../../data/schemas';

interface ScrapeResultViewerProps {
  result: ScrapeResult;
  scrapeId?: string;
}

function buildScreenshotFilename(scrapeId: string | undefined): string {
  return `${scrapeId ?? 'scrape-screenshot'}.png`;
}

export function ScrapeResultViewer({ result, scrapeId }: ScrapeResultViewerProps) {
  const { artefacts, trace, env, error } = result;
  const screenshotFilename = React.useMemo(() => buildScreenshotFilename(scrapeId), [scrapeId]);
  const formattedEnvironment = React.useMemo(() => (env ? formatRunEnvironment(env) : null), [env]);

  return (
    <div className="space-y-4">
      {error ? (
        <Panel variant="brutal">
          <PanelHeader variant="brutal">
            <PanelTitle>Run error</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <CodeBlock code={error} tone="error" viewportClassName="max-h-[240px]" />
          </PanelContent>
        </Panel>
      ) : null}

      <ArtefactViewer
        artefacts={artefacts}
        screenshotAlt="Scrape screenshot"
        screenshotDownloadName={screenshotFilename}
      />

      {trace != null && (
        <Panel variant="brutal">
          <PanelHeader variant="brutal">
            <PanelTitle>Trace</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <CodeBlock code={JSON.stringify(trace, null, 2)} copyable viewportClassName="max-h-[300px]" />
          </PanelContent>
        </Panel>
      )}

      {formattedEnvironment != null && (
        <Panel variant="brutal">
          <PanelHeader variant="brutal">
            <PanelTitle>Environment</PanelTitle>
          </PanelHeader>
          <PanelContent className="min-w-0">
            <CodeBlock code={formattedEnvironment} copyable viewportClassName="max-h-[240px]" />
          </PanelContent>
        </Panel>
      )}
    </div>
  );
}
