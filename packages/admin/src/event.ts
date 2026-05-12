export const ADMIN_EVENT = {
  WORKER_REGISTERED: 'worker.registered',
  WORKER_STOPPED: 'worker.stopped',
} as const;

export interface WorkerLifecycleMetadata {
  hostname: string;
  pid: number;
  port: number;
}