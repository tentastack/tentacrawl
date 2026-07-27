import * as yaml from 'js-yaml';
import {
  DSL_ACTIONS,
  buildDocumentSchema,
  type DslAction,
  type DslActionContribution,
  type DslDocument,
  type ExtendedDslStep,
} from './dsl.schema';
import { renderTemplate } from './template';


export interface CompiledStep {
  index: number;
  action: string;
  selector?: string;
  value?: string;
  outputKey?: string;
  attr?: string;
  condition?: string;
  timeoutMs?: number;
  fields?: Record<string, unknown>;
}

export interface CompileResult {
  name: string;
  steps: CompiledStep[];
}

export interface CompileOptions {
  params?: Record<string, unknown>;
  actions?: ReadonlyArray<DslActionContribution>;
}

export function parseDsl(
  yamlText: string,
  actions: ReadonlyArray<DslActionContribution> = [],
): DslDocument {
  const raw = yaml.load(yamlText);
  return buildDocumentSchema(actions).parse(raw);
}

export function compileDsl(
  doc: DslDocument,
  options: CompileOptions = {},
): CompileResult {
  const params = options.params ?? {};
  const actions = new Map(
    (options.actions ?? []).map((a) => [a.action, a]),
  );

  const steps: CompiledStep[] = doc.steps.map((rawStep, index) => {
    const contribution = isBaseAction(rawStep.action)
      ? undefined
      : actions.get(rawStep.action);
    const step = contribution?.compile
      ? (contribution.compile(rawStep) as ExtendedDslStep)
      : rawStep;

    const compiled: CompiledStep = {
      index,
      action: step.action,
    };

    if (step.selector !== undefined) {
      compiled.selector = renderTemplate(step.selector, params);
    }
    if (step.value !== undefined) {
      compiled.value = renderTemplate(step.value, params);
    }
    if (step.outputKey !== undefined) {
      compiled.outputKey = renderTemplate(step.outputKey, params);
    }
    if (step.attr !== undefined) {
      compiled.attr = step.attr;
    }
    if (step.condition !== undefined) {
      compiled.condition = step.condition;
    }
    if (step.timeoutMs !== undefined) {
      compiled.timeoutMs = step.timeoutMs;
    }
    if (contribution) {
      compiled.fields = { ...step };
    }

    return compiled;
  });

  return { name: doc.name, steps };
}

function isBaseAction(action: string): boolean {
  return DSL_ACTIONS.includes(action as DslAction);
}

export function parseAndCompile(
  yamlText: string,
  options: CompileOptions = {},
): CompileResult {
  const doc = parseDsl(yamlText, options.actions);
  return compileDsl(doc, options);
}
