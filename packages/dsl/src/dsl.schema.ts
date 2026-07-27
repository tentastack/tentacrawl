import { z } from 'zod';
import { BASE_DSL_ACTION_NAMES } from '@tentacrawl/core/dsl-actions';

// shared with core so ChallengerRegistry rejects colliding action names
export const DSL_ACTIONS = BASE_DSL_ACTION_NAMES;

export const dslActionSchema = z.enum(DSL_ACTIONS);
export type DslAction = z.infer<typeof dslActionSchema>;

export const ASSERT_CONDITIONS = [
  'contains',
  'notContains',
  'exists',
  'notExists',
] as const;

export const assertConditionSchema = z.enum(ASSERT_CONDITIONS);
export type AssertCondition = z.infer<typeof assertConditionSchema>;

export const dslStepSchema = z
  .object({
    action: dslActionSchema,
    selector: z.string().optional(),
    value: z.string().optional(),
    outputKey: z.string().optional(),
    attr: z.string().optional(),
    condition: assertConditionSchema.optional(),
    timeoutMs: z.number().int().positive().optional(),
  })
  .refine(
    (s) => {
      if (s.action === 'goto') return !!s.value;
      if (s.action === 'fill') return !!s.selector && s.value !== undefined;
      if (['click', 'waitFor'].includes(s.action)) return !!s.selector;
      if (['extractText', 'extractHtml', 'extract', 'extractAttr'].includes(s.action))
        return !!s.selector && !!s.outputKey;
      if (s.action === 'extractAttr') return !!s.attr;
      if (s.action === 'wait') return !!s.value;
      if (s.action === 'saveSource') return !!s.outputKey;
      if (s.action === 'assert') {
        if (!s.selector || !s.condition) return false;
        if (['contains', 'notContains'].includes(s.condition)) return !!s.value;
        return true;
      }
      return true;
    },
    { message: 'Missing required fields for action' },
  );

export type DslStep = z.infer<typeof dslStepSchema>;

export interface DslActionContribution {
  action: string;
  schema: z.ZodSchema;
  compile?(step: unknown): unknown;
}

export interface ExtendedDslStep {
  action: string;
  selector?: string;
  value?: string;
  outputKey?: string;
  attr?: string;
  condition?: string;
  timeoutMs?: number;
  [k: string]: unknown;
}

export function buildStepSchema(
  actions: ReadonlyArray<DslActionContribution> = [],
): z.ZodType<ExtendedDslStep> {
  let schema: z.ZodType<unknown> = dslStepSchema;
  for (const contribution of actions) {
    if (DSL_ACTIONS.includes(contribution.action as DslAction)) {
      throw new Error(
        `DSL action contribution overrides a base action: ${contribution.action}`,
      );
    }
    schema = schema.or(contribution.schema);
  }
  return schema as z.ZodType<ExtendedDslStep>;
}

export function buildDocumentSchema(
  actions: ReadonlyArray<DslActionContribution> = [],
): z.ZodType<DslDocument> {
  return z.object({
    name: z.string().min(1),
    steps: z.array(buildStepSchema(actions)).min(1),
  }) as z.ZodType<DslDocument>;
}

export const dslDocumentSchema = z.object({
  name: z.string().min(1),
  steps: z.array(dslStepSchema).min(1),
});

export type DslDocument = {
  name: string;
  steps: ExtendedDslStep[];
};
