export class ChallengerStateManager {
  private readonly states = new Map<string, Map<string, unknown>>();

  stateFor(extensionKey: string): Map<string, unknown> {
    let state = this.states.get(extensionKey);
    if (!state) {
      state = new Map<string, unknown>();
      this.states.set(extensionKey, state);
    }
    return state;
  }
}
