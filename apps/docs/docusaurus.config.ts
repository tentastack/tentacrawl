import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const organizationName = 'tentastack';
const projectName = 'tentacrawl';
const repoUrl = `https://github.com/${organizationName}/${projectName}`;

const config: Config = {
  title: 'Tentacrawl',
  tagline:
    'An open source platform for scraping and crawling JavaScript-rendered websites — proxy rotation, captcha solving, and anti-bot evasion built in, and fully extensible through the Challenger framework.',
  favicon: 'img/favicon.png',

  url: 'https://docs.tentacrawl.com',
  baseUrl: '/',

  organizationName,
  projectName,

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  // Self-hosted Inter + JetBrains Mono, matching tentacrawl.com's type system.
  clientModules: [require.resolve('./src/clientModules/fonts.ts')],

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: `${repoUrl}/tree/main/apps/docs/`,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: ['@easyops-cn/docusaurus-search-local'].map((theme) => [
    theme,
    {
      hashed: true,
      indexBlog: false,
      language: ['en'],
    },
  ]) as Config['themes'],

  themeConfig: {
    // TODO: add a static/img/social-card.png (1200x630) and set `image` here
    // once real branding exists, so shared links get an OpenGraph preview.
    metadata: [
      {
        name: 'keywords',
        content:
          'web scraping, web crawler, open source web scraper, open source web crawler, playwright scraping, browser automation, proxy rotation, captcha solving, anti-bot bypass, structured data extraction, LLM data pipeline, RAG data extraction',
      },
    ],
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Tentacrawl.',
      logo: {
        alt: 'Tentacrawl logo',
        src: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'gettingStarted',
          position: 'left',
          label: 'Getting Started',
        },
        {
          type: 'docSidebar',
          sidebarId: 'guides',
          position: 'left',
          label: 'Guides',
        },
        {
          type: 'docSidebar',
          sidebarId: 'extending',
          position: 'left',
          label: 'Extending',
        },
        {
          type: 'docSidebar',
          sidebarId: 'architecture',
          position: 'left',
          label: 'Architecture',
        },
        {
          type: 'docSidebar',
          sidebarId: 'reference',
          position: 'left',
          label: 'Reference',
        },
        {
          href: `${repoUrl}/blob/main/CHANGELOG.md`,
          label: 'Changelog',
          position: 'right',
        },
        {
          href: repoUrl,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Getting Started', to: '/getting-started/installation' },
            { label: 'Extending Tentacrawl', to: '/extending/overview' },
            { label: 'Reference', to: '/reference/rest-api' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'GitHub', href: repoUrl },
            { label: 'Issues', href: `${repoUrl}/issues` },
            { label: 'Discussions', href: `${repoUrl}/discussions` },
          ],
        },
        {
          title: 'Project',
          items: [
            { label: 'Changelog', href: `${repoUrl}/blob/main/CHANGELOG.md` },
            { label: 'License (MIT)', href: `${repoUrl}/blob/main/LICENSE` },
            { label: 'Contributing', to: '/contributing' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} ${projectName}. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'yaml', 'diff'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
