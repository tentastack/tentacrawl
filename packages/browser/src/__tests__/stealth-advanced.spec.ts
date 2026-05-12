import {
  getStealthDefaults,
  buildAcceptLanguage,
  getStealthInitScripts,
  generateStealthSeed,
  STEALTH_INIT_SCRIPTS,
  USER_AGENTS,
  VIEWPORTS,
} from '../stealth';

describe('stealth - UA pool', () => {
  it('contains at least 50 user agents', () => {
    expect(USER_AGENTS.length).toBeGreaterThanOrEqual(50);
  });

  it('includes Chrome, Firefox, Edge, and Safari variants', () => {
    const chrome = USER_AGENTS.filter((ua) => ua.includes('Chrome') && !ua.includes('Edg'));
    const firefox = USER_AGENTS.filter((ua) => ua.includes('Firefox'));
    const edge = USER_AGENTS.filter((ua) => ua.includes('Edg/'));
    const safari = USER_AGENTS.filter((ua) => ua.includes('Safari') && ua.includes('Version/'));
    expect(chrome.length).toBeGreaterThanOrEqual(10);
    expect(firefox.length).toBeGreaterThanOrEqual(5);
    expect(edge.length).toBeGreaterThanOrEqual(5);
    expect(safari.length).toBeGreaterThanOrEqual(2);
  });

  it('includes Windows, macOS, and Linux variants', () => {
    expect(USER_AGENTS.some((ua) => ua.includes('Windows NT'))).toBe(true);
    expect(USER_AGENTS.some((ua) => ua.includes('Macintosh'))).toBe(true);
    expect(USER_AGENTS.some((ua) => ua.includes('Linux'))).toBe(true);
  });
});

describe('stealth - viewport pool', () => {
  it('contains at least 20 viewports', () => {
    expect(VIEWPORTS.length).toBeGreaterThanOrEqual(20);
  });

  it('ranges from 1024 to 2560 width', () => {
    const widths = VIEWPORTS.map((v) => v.width);
    expect(Math.min(...widths)).toBeLessThanOrEqual(1024);
    expect(Math.max(...widths)).toBeGreaterThanOrEqual(2560);
  });
});

describe('buildAcceptLanguage', () => {
  it('builds header for locale with region', () => {
    expect(buildAcceptLanguage('en-US')).toBe('en-us,en;q=0.9,en;q=0.8,*;q=0.5');
  });

  it('builds header for locale without region', () => {
    expect(buildAcceptLanguage('en')).toBe('en,en;q=0.9,*;q=0.5');
  });

  it('handles non-English locales', () => {
    const result = buildAcceptLanguage('de-DE');
    expect(result).toContain('de-de');
    expect(result).toContain('de;q=0.9');
  });
});

describe('STEALTH_INIT_SCRIPTS', () => {
  it('has 8 init scripts', () => {
    expect(STEALTH_INIT_SCRIPTS).toHaveLength(8);
  });

  it('includes all expected patches', () => {
    const names = STEALTH_INIT_SCRIPTS.map((s) => s.name);
    expect(names).toEqual([
      'webdriver',
      'chrome-runtime',
      'permissions',
      'plugins',
      'webgl-vendor',
      'canvas-noise',
      'connection-rtt',
      'audio-context',
    ]);
  });

  it('all scripts are functions', () => {
    for (const script of STEALTH_INIT_SCRIPTS) {
      expect(typeof script.fn).toBe('function');
    }
  });
});

describe('generateStealthSeed', () => {
  it('generates different seeds across calls', () => {
    const seeds = Array.from({ length: 20 }, () => generateStealthSeed());
    const canvasSeeds = new Set(seeds.map((s) => s.canvasSeed));
    expect(canvasSeeds.size).toBeGreaterThan(1);
  });

  it('returns locale-appropriate languages', () => {
    const deSeed = generateStealthSeed('de-DE');
    expect(deSeed.languages[0]).toBe('de-DE');
    const enSeed = generateStealthSeed('en-US');
    expect(enSeed.languages[0]).toBe('en-US');
  });

  it('populates webgl profile', () => {
    const seed = generateStealthSeed();
    expect(seed.webgl.vendor).toBeDefined();
    expect(seed.webgl.renderer).toBeDefined();
  });
});

describe('getStealthInitScripts', () => {
  it('returns scripts with seed-dependent args', () => {
    const seed = generateStealthSeed();
    const scripts = getStealthInitScripts(seed);
    const pluginsScript = scripts.find((s) => s.name === 'plugins');
    expect(pluginsScript?.arg).toEqual({
      pluginCount: seed.pluginCount,
      languages: seed.languages,
    });
    const canvasScript = scripts.find((s) => s.name === 'canvas-noise');
    expect(canvasScript?.arg).toBe(seed.canvasSeed);
  });
});

describe('getStealthDefaults', () => {
  it('returns values from the expanded pools', () => {
    for (let i = 0; i < 20; i++) {
      const { userAgent, viewport } = getStealthDefaults();
      expect(USER_AGENTS).toContain(userAgent);
      expect(VIEWPORTS).toContainEqual(viewport);
    }
  });

  it('has good entropy over multiple calls', () => {
    const uas = new Set<string>();
    const vps = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const d = getStealthDefaults();
      uas.add(d.userAgent);
      vps.add(`${d.viewport.width}x${d.viewport.height}`);
    }
    expect(uas.size).toBeGreaterThan(5);
    expect(vps.size).toBeGreaterThan(3);
  });
});
