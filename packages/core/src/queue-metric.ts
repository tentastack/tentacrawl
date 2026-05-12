export const QUEUE_METRIC_RECORDER = Symbol('QUEUE_METRIC_RECORDER');

export type QueueJobTerminalState = 'completed' | 'failed';

export interface QueueMetricRecorder {
  recordJobStart(queueName: string): void;
  recordJobCompletion(queueName: string, state: QueueJobTerminalState, durationMs: number): void;
}