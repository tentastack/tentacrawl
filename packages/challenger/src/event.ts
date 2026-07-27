export const CHALLENGER_EVENTS = {
  signalEmitted: 'challenger.signal.emitted',
  extensionToggled: 'challenger.extension.toggled',
} as const;

export type ChallengerEvent =
  (typeof CHALLENGER_EVENTS)[keyof typeof CHALLENGER_EVENTS];
