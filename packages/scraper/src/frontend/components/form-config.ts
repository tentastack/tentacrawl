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
import { createScrapeDto } from '../../data/schemas';

export const createScrapeFormSchema = createScrapeDto.extend({
  async: z.literal(true).default(true),
});

export const scrapeFormFields: CrudField[] = [
  { name: 'url', label: 'URL', type: 'url', required: true, placeholder: 'https://example.com' },
  {
    name: 'waitFor',
    label: 'Wait Until',
    type: 'select',
    sectionTitle: 'Page readiness',
    sectionDescription: 'Tune when the page is considered ready and how long the runner should wait before collecting artefacts.',
    options: [
      { label: 'DOM Content Loaded', value: 'domcontentloaded' },
      { label: 'Load', value: 'load' },
      { label: 'Network Idle', value: 'networkidle' },
    ],
  },
  { name: 'timeout', label: 'Timeout (ms)', type: 'number', placeholder: '30000' },
  {
    name: 'artefacts',
    label: 'Artefacts',
    type: 'multiselect',
    description: 'Hover an artefact to see what it is useful for.',
    options: [
      {
        label: 'HTML',
        value: 'html',
        description: 'Keep the raw rendered DOM when you need exact markup, selectors, or post-run debugging.',
      },
      {
        label: 'Markdown',
        value: 'markdown',
        description: 'Get a cleaner text version that works well for LLM prompts, RAG pipelines, or editorial review.',
      },
      {
        label: 'Metadata',
        value: 'metadata',
        description: 'Capture page title, canonical, meta tags, language, and similar signals for indexing or QA.',
      },
      {
        label: 'Links',
        value: 'links',
        description: 'Extract discovered links for navigation analysis, crawl seeding, or internal linking audits.',
      },
      {
        label: 'Screenshot',
        value: 'screenshot',
        description: 'Store a visual snapshot for evidence, manual review, or layout regression checks.',
      },
      {
        label: 'Extracted',
        value: 'extracted',
        description: 'Produce structured extracted data for downstream automation, enrichment, or JSON-style processing.',
      },
    ],
  },
  {
    name: 'networkPolicy',
    label: 'Network Policy',
    hideLabel: true,
    type: 'custom',
    render: ({ value, onChange, error }) => React.createElement(NetworkPolicyField, {
      value,
      onChange,
      error,
    }),
  },
  {
    name: 'locale',
    label: 'Locale',
    type: 'custom',
    sectionTitle: 'Regional settings',
    sectionDescription: 'Use browser-backed suggestions for locale and timezone instead of typing them from memory.',
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
    sectionDividerBefore: true,
    render: ({ value, onChange, error }) => React.createElement(HeaderMapField, {
      value,
      onChange,
      error,
    }),
  },
  {
    name: 'dsl',
    label: 'DSL Script',
    type: 'textarea',
    sectionTitle: 'Browser flow override',
    sectionDescription: 'Provide a YAML DSL script only when the default single-page flow is not enough.',
    placeholder: 'Optional YAML DSL script...',
    description: 'Provide an optional YAML DSL override for advanced browser flow control.',
  },
];

export const scrapeFormGroups: CrudFormGroup[] = [
  {
    title: 'Target page',
    description: 'Choose the page to open for this scrape run.',
    fields: ['url'],
  },
  {
    title: 'Artefacts',
    description: 'Choose which artifacts should be generated and stored for this scrape run.',
    fields: ['artefacts'],
  },
  {
    title: 'Network',
    description: 'Control proxy routing and network access for the scrape run.',
    fields: ['networkPolicy'],
  },
  {
    title: 'Advanced options',
    description: 'Optional timing controls, runtime overrides, custom headers, and DSL-driven browser flow.',
    fields: ['waitFor', 'timeout', 'locale', 'timezone', 'headers', 'dsl'],
    collapsible: true,
  },
];

export const scrapeFormInitialValues = {
  url: '',
  artefacts: ['html', 'markdown', 'metadata', 'links'],
  networkPolicy: { mode: 'none' },
  waitFor: 'domcontentloaded',
  timeout: 30000,
};
