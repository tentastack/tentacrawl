import type { ZodSchema } from 'zod';

export interface DslExtension {
  readonly moduleId: string;
  extendStepSchema(): ZodSchema;
  compileStep?(step: unknown): unknown;
}
