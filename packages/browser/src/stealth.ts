
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15.0; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15.1; rv:131.0) Gecko/20100101 Firefox/131.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
  { width: 1680, height: 1050 },
  { width: 2560, height: 1440 },
  { width: 1280, height: 800 },
  { width: 1440, height: 960 },
  { width: 1512, height: 982 },
  { width: 1728, height: 1117 },
  { width: 1360, height: 768 },
  { width: 1400, height: 900 },
  { width: 1600, height: 1024 },
  { width: 1280, height: 1024 },
  { width: 1920, height: 1200 },
  { width: 2560, height: 1600 },
  { width: 1024, height: 768 },
  { width: 1344, height: 756 },
];

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface StealthDefaults {
  userAgent: string;
  viewport: { width: number; height: number };
}

export function getStealthDefaults(): StealthDefaults {
  return {
    userAgent: randomItem(USER_AGENTS),
    viewport: randomItem(VIEWPORTS),
  };
}

export function buildAcceptLanguage(locale: string): string {
  const primary = locale.toLowerCase();
  const lang = primary.split('-')[0];
  if (lang === primary) return `${primary},en;q=0.9,*;q=0.5`;
  return `${primary},${lang};q=0.9,en;q=0.8,*;q=0.5`;
}

const WEBGL_PROFILES = [
  { vendor: 'Intel Inc.', renderer: 'Intel Iris OpenGL Engine' },
  { vendor: 'Intel Inc.', renderer: 'Intel Iris Plus Graphics 640' },
  { vendor: 'Intel Inc.', renderer: 'Intel UHD Graphics 630' },
  { vendor: 'Intel Inc.', renderer: 'Intel Iris Xe Graphics' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)' },
] as const;

const LANGUAGE_POOLS: Record<string, string[]> = {
  en: ['en-US', 'en'],
  de: ['de-DE', 'de', 'en-US', 'en'],
  fr: ['fr-FR', 'fr', 'en-US', 'en'],
  es: ['es-ES', 'es', 'en-US', 'en'],
  pl: ['pl-PL', 'pl', 'en-US', 'en'],
  pt: ['pt-BR', 'pt', 'en-US', 'en'],
  it: ['it-IT', 'it', 'en-US', 'en'],
  ja: ['ja-JP', 'ja', 'en-US', 'en'],
  zh: ['zh-CN', 'zh', 'en-US', 'en'],
};

export interface StealthSeed {
  canvasSeed: number;
  rtt: number;
  pluginCount: number;
  webgl: { vendor: string; renderer: string };
  languages: string[];
}

export function generateStealthSeed(locale?: string): StealthSeed {
  const lang = (locale ?? 'en-US').split('-')[0].toLowerCase();
  return {
    canvasSeed: Math.random(),
    rtt: randomItem([50, 75, 100, 125, 150, 200]),
    pluginCount: 3 + Math.floor(Math.random() * 4),
    webgl: randomItem(WEBGL_PROFILES),
    languages: LANGUAGE_POOLS[lang] ?? LANGUAGE_POOLS['en'],
  };
}

export type StealthInitScript = { name: string; fn: (arg: unknown) => void; arg?: unknown };

export function getStealthInitScripts(seed: StealthSeed): StealthInitScript[] {
  return [
    {
      name: 'webdriver',
      fn: () => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      },
    },
    {
      name: 'chrome-runtime',
      fn: () => {
        const w = window as unknown as Record<string, unknown>;
        if (!w['chrome']) {
          w['chrome'] = { runtime: {}, loadTimes: () => ({}), csi: () => ({}) };
        }
      },
    },
    {
      name: 'permissions',
      fn: () => {
        const originalQuery = (navigator.permissions as unknown as { query?: Function })?.query;
        if (originalQuery) {
          const perms = navigator.permissions as unknown as Record<string, unknown>;
          perms['query'] = (params: { name: string }) =>
            params.name === 'notifications'
              ? Promise.resolve({ state: Notification.permission })
              : originalQuery.call(navigator.permissions, params);
        }
      },
    },
    {
      name: 'plugins',
      fn: (arg: unknown) => {
        const { pluginCount, languages } = arg as { pluginCount: number; languages: string[] };
        Object.defineProperty(navigator, 'plugins', {
          get: () => Array.from({ length: pluginCount }, (_, i) => i + 1),
        });
        Object.defineProperty(navigator, 'languages', {
          get: () => languages,
        });
      },
      arg: { pluginCount: seed.pluginCount, languages: seed.languages },
    },
    {
      name: 'webgl-vendor',
      fn: (arg: unknown) => {
        const { vendor, renderer } = arg as { vendor: string; renderer: string };
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (param: number) {
          // 0x9245 = UNMASKED_VENDOR_WEBGL, 0x9246 = UNMASKED_RENDERER_WEBGL
          if (param === 0x9245) return vendor;
          if (param === 0x9246) return renderer;
          return getParameter.call(this, param);
        };
      },
      arg: seed.webgl,
    },
    {
      name: 'canvas-noise',
      fn: (arg: unknown) => {
        const canvasSeed = arg as number;
        const toDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function (type?: string) {
          const ctx = this.getContext('2d');
          if (ctx) {
            const shift = (canvasSeed * 255) / 10000;
            const imageData = ctx.getImageData(0, 0, this.width, this.height);
            for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i] = imageData.data[i] + shift > 255 ? 255 : imageData.data[i] + shift;
            }
            ctx.putImageData(imageData, 0, 0);
          }
          return toDataURL.call(this, type);
        };
      },
      arg: seed.canvasSeed,
    },
    {
      name: 'connection-rtt',
      fn: (arg: unknown) => {
        const rtt = arg as number;
        if ('connection' in navigator) {
          const conn = (navigator as Record<string, unknown>)['connection'];
          if (conn && typeof conn === 'object') {
            Object.defineProperty(conn, 'rtt', { get: () => rtt, configurable: true });
          }
        }
      },
      arg: seed.rtt,
    },
    {
      name: 'audio-context',
      fn: () => {
        const origGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
        AnalyserNode.prototype.getFloatFrequencyData = function (array) {
          origGetFloatFrequencyData.call(this, array);
          for (let i = 0; i < array.length; i++) {
            array[i] += (Math.random() - 0.5) * 0.001;
          }
        };
      },
    },
  ];
}

// Exported as a stable test fixture for the current stealth tests.
export const STEALTH_INIT_SCRIPTS = getStealthInitScripts(generateStealthSeed());

export { USER_AGENTS, VIEWPORTS };
