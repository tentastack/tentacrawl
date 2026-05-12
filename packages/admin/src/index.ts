import type { ModuleInfo } from '@tentacrawl/core';

export const metadata: ModuleInfo = {
  name: 'admin',
  title: 'Admin Monitoring',
  version: '0.1.0',
  description: 'Dashboard, worker presence, and operational activity tracking',
  navigation: {
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    path: '/dashboard',
    order: 0,
  },
  routes: [
    { path: 'dashboard', page: 'dashboard', title: 'Dashboard' },
  ],
};

export { AdminModule } from './admin.module';
export { ADMIN_EVENT } from './event';
export type { WorkerLifecycleMetadata } from './event';
export {
  dashboardOverviewSchema,
  activityLogItemSchema,
  queueSnapshotSchema,
  workerHealthSchema,
  workerSnapshotSchema,
  workerSummarySchema,
} from './data/schemas';
export type {
  ActivityLogItem,
  DashboardOverview,
  QueueSnapshot,
  WorkerHealth,
  WorkerSnapshot,
  WorkerSummary,
} from './data/schemas';
export { ActivityLogEntity, WorkerInstanceEntity } from './data/entities';
export { WorkerPresenceService } from './worker/worker-presence.service';