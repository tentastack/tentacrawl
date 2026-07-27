export { ChallengerListPage as ExtensionsListPage } from './pages/extensions/page';
export { ChallengerDetailPage as ExtensionsDetailPage } from './pages/extensions/[id]/page';
export {
  useChallengers,
  useChallenger,
  useChallengerSignals,
  useChallengerConfig,
  useSetChallengerEnabled,
  useSetChallengerConfig,
} from './hooks/use-challengers';
export type { ChallengerListItem, ChallengerSignalItem } from '../data/schemas';
