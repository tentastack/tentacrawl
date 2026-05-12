import * as React from 'react';
import { z } from 'zod';
import {
  HeaderMapField,
  LocaleField,
  NetworkPolicyField,
  TimezoneField,
  type CrudField,
  type CrudFormGroup,
} from '@tentacrawl/ui';
import { createCrawlDto } from '../../data/schemas';

export const createCrawlFormSchema = createCrawlDto;

export const crawlFormFields: CrudField[] = [
  {
    name: 'url',
    label: 'Start URL',
    type: 'url',
    required: true,
    placeholder: 'https://example.com/docs',
    sectionTitle: 'Entry point',
    sectionDescription: 'Choose the first page the crawler should open and treat as the crawl seed.',
  },
  {
    name: 'maxDepth',
    label: 'Maximum depth',
    type: 'number',
    required: true,
    description: 'Depth 0 processes only the start page. Increase depth to follow links outward.',
    placeholder: '2',
  },
  {
    name: 'maxPages',
    label: 'Maximum pages',
    type: 'number',
    required: true,
    description: 'Hard cap on the number of pages the orchestrator may enqueue for this crawl.',
    placeholder: '50',
  },
  {
    name: 'artefacts',
    label: 'Artefacts',
    type: 'multiselect',
    sectionTitle: 'Stored artefacts',
    sectionDescription: 'Choose which artifacts should be captured for every page that completes successfully.',
    options: [
      {
        label: 'HTML',
        value: 'html',
        description: 'Store the rendered markup for debugging, selectors, and exact DOM inspection.',
      },
      {
        label: 'Markdown',
        value: 'markdown',
        description: 'Store cleaned text that is easier to review, index, and use in AI workflows.',
      },
      {
        label: 'Metadata',
        value: 'metadata',
        description: 'Capture title, canonical, language, and other page-level metadata signals.',
      },
      {
        label: 'Links',
        value: 'links',
        description: 'Keep discovered links for crawl expansion analysis and internal-link auditing.',
      },
      {
        label: 'Screenshot',
        value: 'screenshot',
        description: 'Save a visual snapshot for QA, evidence, or manual review.',
      },
      {
        label: 'Extracted',
        value: 'extracted',
        description: 'Persist structured extracted artefacts for downstream processing.',
      },
    ],
  },
  {
    name: 'includePattern',
    label: 'Include pattern',
    type: 'text',
    sectionTitle: 'URL filtering',
    sectionDescription: 'Use optional regex filters to constrain which discovered URLs stay inside the crawl frontier.',
    placeholder: '^https://example.com/docs',
    description: 'Only enqueue discovered URLs that match this pattern. Leave empty to allow all discovered URLs.',
  },
  {
    name: 'excludePattern',
    label: 'Exclude pattern',
    type: 'text',
    placeholder: '/(login|account|checkout)',
    description: 'Skip discovered URLs that match this pattern even if they match the include pattern.',
  },
  {
    name: 'networkPolicy',
    label: 'Network policy',
    hideLabel: true,
    type: 'custom',
    sectionTitle: 'Network routing',
    sectionDescription: 'Choose whether the crawl runs direct, through a static proxy, or against a managed pool.',
    render: ({ value, onChange, error }) => React.createElement(NetworkPolicyField, {
      value,
      onChange,
      error,
    }),
  },
  {
    name: 'waitFor',
    label: 'Wait until',
    type: 'select',
    sectionTitle: 'Runtime behavior',
    sectionDescription: 'Tune when a page is considered ready and how long the runner may wait before timing out.',
    options: [
      { label: 'DOM Content Loaded', value: 'domcontentloaded' },
      { label: 'Load', value: 'load' },
      { label: 'Network Idle', value: 'networkidle' },
    ],
  },
  {
    name: 'timeout',
    label: 'Timeout (ms)',
    type: 'number',
    placeholder: '30000',
  },
  {
    name: 'locale',
    label: 'Locale',
    type: 'custom',
    render: ({ value, onChange, error }) => React.createElement(LocaleField, {
      value,
      onChange,
      error,
    }),
  },
  {
    name: 'timezone',
    label: 'Timezone',
    type: 'custom',
    render: ({ value, onChange, error }) => React.createElement(TimezoneField, {
      value,
      onChange,
      error,
    }),
  },
  {
    name: 'headers',
    label: 'Headers',
    hideLabel: true,
    type: 'custom',
    render: ({ value, onChange, error }) => React.createElement(HeaderMapField, {
      value,
      onChange,
      error,
    }),
  },
  {
    name: 'dsl',
    label: 'DSL script',
    type: 'textarea',
    sectionDividerBefore: true,
    placeholder: 'Optional YAML DSL script...',
    description: 'Override the default per-page behavior when the crawl needs custom browser actions or extraction flow.',
  },
];

export const crawlFormGroups: CrudFormGroup[] = [
  {
    title: 'Seed page',
    description: 'Define where the crawl begins.',
    fields: ['url'],
  },
  {
    title: 'Scope limits',
    description: 'Set the depth and page budget so the crawl stays bounded and predictable.',
    fields: ['maxDepth', 'maxPages'],
  },
  {
    title: 'Artefacts',
    description: 'Choose which artifacts should be stored for each processed page.',
    fields: ['artefacts'],
  },
  {
    title: 'URL frontier rules',
    description: 'Constrain which discovered links are allowed back into the crawl queue.',
    fields: ['includePattern', 'excludePattern'],
  },
  {
    title: 'Network',
    description: 'Control direct traffic or proxy routing for the entire crawl run.',
    fields: ['networkPolicy'],
  },
  {
    title: 'Advanced options',
    description: 'Tune timing, browser locale, custom headers, and per-page DSL overrides when needed.',
    fields: ['waitFor', 'timeout', 'locale', 'timezone', 'headers', 'dsl'],
    collapsible: true,
  },
];

export const crawlFormInitialValues: z.input<typeof createCrawlDto> = {
  url: '',
  maxDepth: 2,
  maxPages: 50,
  artefacts: ['html', 'markdown', 'metadata', 'links'],
  networkPolicy: { mode: 'none' },
  waitFor: 'domcontentloaded',
  timeout: 30000,
  includePattern: '',
  excludePattern: '',
  dsl: '',
};