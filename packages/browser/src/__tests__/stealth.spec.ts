import { getStealthDefaults, USER_AGENTS, VIEWPORTS } from '../stealth';

describe('stealth', () => {
  it('returns a user agent from the known list', () => {
    const { userAgent } = getStealthDefaults();
    expect(USER_AGENTS).toContain(userAgent);
  });

  it('returns a viewport from the known list', () => {
    const { viewport } = getStealthDefaults();
    expect(VIEWPORTS).toContainEqual(viewport);
  });

  it('returns different results over multiple calls (probabilistic)', () => {
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      results.add(getStealthDefaults().userAgent);
    }
    // with 5 options and 50 tries, probability of only 1 is ~(1/5)^49
    expect(results.size).toBeGreaterThan(1);
  });
});
