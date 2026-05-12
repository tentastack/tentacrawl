'use client';

import * as React from 'react';
import type { ArtefactResult, PageLink, PageMetadata } from '@tentacrawl/core';
import { extractUrlHostname } from '@tentacrawl/core/url';
import { Download } from 'lucide-react';
import { Braces, Camera, Code2, FileText, Info, Link2, Radar } from 'lucide-react';
import { prettifyHtml } from '../lib/code-format';
import {
  countLines,
  countObjectLeaves,
  countWords,
  formatBytes,
  getBase64ByteSize,
  getByteSize,
} from '../lib/artefact-metrics';
import { Button } from '../primitives/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../primitives/tabs';
import { CodeBlock } from './code-block';
import { StatusDot } from './status-dot';

export interface ArtefactMetricItem {
  label: string;
  value: string;
}

export interface ArtefactLinkItem {
  url: string;
  text?: string;
  isInternal?: boolean;
}

interface ArtefactTabBase {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  metrics: ArtefactMetricItem[];
}

export interface ArtefactCodeTab extends ArtefactTabBase {
  kind: 'code';
  code: string;
  viewportClassName?: string;
}

export interface ArtefactLinksTab extends ArtefactTabBase {
  kind: 'links';
  items: ArtefactLinkItem[];
  maxItems?: number;
}

export interface ArtefactImageTab extends ArtefactTabBase {
  kind: 'image';
  image: string;
  alt: string;
  downloadName: string;
}

export type ArtefactTab = ArtefactCodeTab | ArtefactLinksTab | ArtefactImageTab;

function buildTextMetrics(content: string): ArtefactMetricItem[] {
  return [
    { label: 'Content size', value: formatBytes(getByteSize(content)) },
    { label: 'Characters', value: content.length.toLocaleString() },
    { label: 'Words', value: countWords(content).toLocaleString() },
    { label: 'Lines', value: countLines(content).toLocaleString() },
  ];
}

function buildMetadataMetrics(metadata: PageMetadata, payload: string): ArtefactMetricItem[] {
  const populatedFields = Object.values(metadata).filter(Boolean).length;
  const socialFields = Object.entries(metadata)
    .filter(([key, value]) => (key.startsWith('og') || key.startsWith('twitter')) && Boolean(value))
    .length;
  const urlFields = [metadata.canonicalUrl, metadata.favicon, metadata.ogImage, metadata.ogUrl, metadata.twitterImage]
    .filter(Boolean)
    .length;

  return [
    { label: 'Populated fields', value: populatedFields.toLocaleString() },
    { label: 'Social tags', value: socialFields.toLocaleString() },
    { label: 'URL fields', value: urlFields.toLocaleString() },
    { label: 'Payload size', value: formatBytes(getByteSize(payload)) },
  ];
}

function buildLinksMetrics(links: PageLink[]): ArtefactMetricItem[] {
  const internalCount = links.filter((link) => link.isInternal).length;
  const externalCount = links.length - internalCount;
  const uniqueHosts = new Set(
    links.map((link) => extractUrlHostname(link.url)),
  ).size;

  return [
    { label: 'Total links', value: links.length.toLocaleString() },
    { label: 'Internal', value: internalCount.toLocaleString() },
    { label: 'External', value: externalCount.toLocaleString() },
    { label: 'Unique hosts', value: uniqueHosts.toLocaleString() },
  ];
}

function buildExtractedMetrics(extracted: Record<string, unknown>, payload: string): ArtefactMetricItem[] {
  const topLevelFields = Object.keys(extracted).length;
  const leafValues = countObjectLeaves(extracted);

  return [
    { label: 'Top-level fields', value: topLevelFields.toLocaleString() },
    { label: 'Leaf values', value: leafValues.toLocaleString() },
    { label: 'Characters', value: payload.length.toLocaleString() },
    { label: 'Payload size', value: formatBytes(getByteSize(payload)) },
  ];
}

function buildDiscoveredUrlsMetrics(discoveredUrls: string[], payload: string): ArtefactMetricItem[] {
  return [
    { label: 'Discovered URLs', value: discoveredUrls.length.toLocaleString() },
    { label: 'Characters', value: payload.length.toLocaleString() },
    { label: 'Words', value: countWords(payload).toLocaleString() },
    { label: 'Lines', value: countLines(payload).toLocaleString() },
  ];
}

function renderMetrics(items: ArtefactMetricItem[]) {
  return (
    <div className="grid gap-2 border-t border-ink/10 pt-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="border border-ink/10 bg-base px-3 py-2">
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-muted">
            {item.label}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function ArtefactImagePanel({ tab }: { tab: ArtefactImageTab }) {
  const [dimensions, setDimensions] = React.useState<{ width: number; height: number } | null>(null);

  React.useEffect(() => {
    const image = new Image();
    image.onload = () => {
      setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      setDimensions(null);
    };
    image.src = `data:image/png;base64,${tab.image}`;

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [tab.image]);

  const metrics = [
    ...tab.metrics,
    {
      label: 'Dimensions',
      value: dimensions ? `${dimensions.width} x ${dimensions.height}px` : 'Loading...',
    },
  ];

  return (
    <>
      <div className="relative border border-ink/10 bg-base p-3">
        <div className="pointer-events-none absolute right-3 top-3 z-10">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            asChild
            className="pointer-events-auto h-7 gap-1 rounded-none border-0 bg-surface px-1.5 text-[11px] font-mono uppercase tracking-[0.14em] text-foreground shadow-none backdrop-blur-[2px] hover:bg-base hover:text-foreground"
          >
            <a href={`data:image/png;base64,${tab.image}`} download={tab.downloadName}>
              <Download className="size-3.5" />
              <span className="whitespace-nowrap pl-1">Download</span>
            </a>
          </Button>
        </div>
        <img
          src={`data:image/png;base64,${tab.image}`}
          alt={tab.alt}
          className="max-w-full"
        />
      </div>
      {renderMetrics(metrics)}
    </>
  );
}

function ArtefactLinksPanel({ tab }: { tab: ArtefactLinksTab }) {
  const visibleItems = tab.items.slice(0, tab.maxItems ?? 100);

  return (
    <>
      <div className="tc-scrollbar max-h-[500px] space-y-3 overflow-auto pr-1">
        {visibleItems.map((link) => (
          <a
            key={`${link.url}-${link.text ?? ''}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start justify-between gap-3 border border-ink/10 bg-base px-3 py-3 text-sm transition-colors hover:border-brand/40"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{link.text || link.url}</p>
              <p className="truncate font-mono text-xs text-muted">{link.url}</p>
            </div>
            <StatusDot status={link.isInternal == null ? 'neutral' : link.isInternal ? 'success' : 'info'} />
          </a>
        ))}
      </div>
      {renderMetrics(tab.metrics)}
    </>
  );
}

export interface ArtefactViewerProps {
  artefacts: ArtefactResult;
  discoveredUrls?: string[];
  screenshotAlt?: string;
  screenshotDownloadName?: string;
  linkLimit?: number;
}

export function ArtefactViewer({
  artefacts,
  discoveredUrls,
  screenshotAlt = 'Artefact screenshot',
  screenshotDownloadName = 'artefact-screenshot.png',
  linkLimit,
}: ArtefactViewerProps) {
  const tabs = React.useMemo<ArtefactTab[]>(() => {
    const nextTabs: ArtefactTab[] = [];

    if (artefacts.markdown) {
      nextTabs.push({
        kind: 'code',
        value: 'markdown',
        label: 'Markdown',
        code: artefacts.markdown,
        icon: FileText,
        metrics: buildTextMetrics(artefacts.markdown),
      });
    }

    if (artefacts.html) {
      const html = prettifyHtml(artefacts.html);
      nextTabs.push({
        kind: 'code',
        value: 'html',
        label: 'HTML',
        code: html,
        icon: Code2,
        metrics: buildTextMetrics(html),
      });
    }

    if (artefacts.metadata) {
      const payload = JSON.stringify(artefacts.metadata, null, 2);
      nextTabs.push({
        kind: 'code',
        value: 'metadata',
        label: 'Metadata',
        code: payload,
        icon: Info,
        metrics: buildMetadataMetrics(artefacts.metadata, payload),
      });
    }

    if (artefacts.links) {
      nextTabs.push({
        kind: 'links',
        value: 'links',
        label: 'Links',
        items: artefacts.links,
        icon: Link2,
        metrics: buildLinksMetrics(artefacts.links),
        maxItems: linkLimit,
      });
    }

    if (artefacts.extracted) {
      const payload = JSON.stringify(artefacts.extracted, null, 2);
      nextTabs.push({
        kind: 'code',
        value: 'extracted',
        label: 'Extracted',
        code: payload,
        icon: Braces,
        metrics: buildExtractedMetrics(artefacts.extracted, payload),
      });
    }

    if (artefacts.screenshot) {
      nextTabs.push({
        kind: 'image',
        value: 'screenshot',
        label: 'Screenshot',
        image: artefacts.screenshot,
        alt: screenshotAlt,
        downloadName: screenshotDownloadName,
        icon: Camera,
        metrics: [
          { label: 'Image format', value: 'PNG' },
          { label: 'Payload size', value: formatBytes(getBase64ByteSize(artefacts.screenshot)) },
        ],
      });
    }

    if (discoveredUrls && discoveredUrls.length > 0) {
      const payload = discoveredUrls.join('\n');
      nextTabs.push({
        kind: 'code',
        value: 'discovered',
        label: 'Discovered URLs',
        code: payload,
        icon: Radar,
        metrics: buildDiscoveredUrlsMetrics(discoveredUrls, payload),
      });
    }

    return nextTabs;
  }, [artefacts, discoveredUrls, linkLimit, screenshotAlt, screenshotDownloadName]);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="min-w-0 border border-ink bg-surface shadow-brutal-sm">
      <Tabs defaultValue={tabs[0].value}>
        <TabsList variant="brutal">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} variant="brutal">
              <tab.icon className="mr-1.5 size-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-0 min-w-0">
            <div className="min-w-0 space-y-4 p-5">
              {tab.kind === 'image' ? <ArtefactImagePanel tab={tab} /> : null}
              {tab.kind === 'links' ? <ArtefactLinksPanel tab={tab} /> : null}
              {tab.kind === 'code' ? (
                <>
                  <CodeBlock code={tab.code} copyable viewportClassName={tab.viewportClassName ?? 'max-h-[500px]'} />
                  {renderMetrics(tab.metrics)}
                </>
              ) : null}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}