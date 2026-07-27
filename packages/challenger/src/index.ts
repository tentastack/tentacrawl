import type { ModuleInfo } from '@tentacrawl/core';

export const metadata: ModuleInfo = {
  name: 'challenger',
  title: 'Challenger Extensions',
  version: '0.1.0',
  description: 'Challenger extension framework host: dispatch, signals, admin dashboard',
  navigation: {
    label: 'Extensions',
    icon: 'Puzzle',
    path: '/extensions',
    order: 90,
  },
  routes: [
    { path: 'extensions', page: 'extensions-list', title: 'Extensions' },
    { path: 'extensions/:id', page: 'extensions-detail', title: 'Extension Detail' },
  ],
};

export { ChallengerModule } from './challenger.module';

export { ChallengerDispatcherService } from './worker/challenger-dispatcher.service';
export { ChallengerSignalBus, redactSensitive } from './worker/challenger-signal.bus';
export { ChallengerActionRegistryService } from './worker/challenger-action.registry';
export { ChallengerStateManager } from './worker/challenger-state.manager';
export {
  ChallengerRunSessionImpl,
} from './worker/challenger-run-session';
export type {
  CollectedHandler,
  CollectedStage,
  RunnableExtension,
  RunSessionHooks,
  RunSessionLogger,
} from './worker/challenger-run-session';

export { asPage, asContext, asBrowser, asRequest, asResponse } from './raw-helpers';

export {
  challengerListItemSchema,
  challengerSignalItemSchema,
  challengerHealthSchema,
  setChallengerEnabledDto,
  setChallengerConfigDto,
} from './data/schemas';
export type {
  ChallengerListItem,
  ChallengerSignalItem,
  ChallengerHealth,
  SetChallengerEnabledDto,
  SetChallengerConfigDto,
} from './data/schemas';

export {
  ChallengerRegistrationEntity,
  ChallengerConfigEntity,
  ChallengerSignalEntity,
} from './data/entities';
