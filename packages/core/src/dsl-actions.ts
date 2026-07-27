// shared by @tentacrawl/dsl and ChallengerRegistry; dependency-free for dsl to import
export const BASE_DSL_ACTION_NAMES = [
  'goto',
  'click',
  'fill',
  'waitFor',
  'extractText',
  'extractHtml',
  'extractAttr',
  'extract',
  'screenshot',
  'wait',
  'saveSource',
  'assert',
] as const;

export type BaseDslActionName = (typeof BASE_DSL_ACTION_NAMES)[number];
