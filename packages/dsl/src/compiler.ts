import * as yaml from 'js-yaml';
import { dslDocumentSchema, type DslDocument, type DslStep } from './dsl.schema';
import { renderTemplate } from './template';


export interface CompiledStep {
  index: number;
  action: DslStep['action'];
  selector?: string;
  value?: string;
  outputKey?: string;
  attr?: string;
  condition?: string;
  timeoutMs?: number;
}

export interface CompileResult {
  name: string;
  steps: CompiledStep[];
}

export interface CompileOptions {
  params?: Record<string, unknown>;
}

export function parseDsl(yamlText: string): DslDocument {
  const raw = yaml.load(yamlText);
  return dslDocumentSchema.parse(raw);
}

export function compileDsl(
  doc: DslDocument,
  options: CompileOptions = {},
): CompileResult {
  const params = options.params ?? {};

  const steps: CompiledStep[] = doc.steps.map((step, index) => {
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

    return compiled;
  });

  return { name: doc.name, steps };
}

export function parseAndCompile(
  yamlText: string,
  options: CompileOptions = {},
): CompileResult {
  const doc = parseDsl(yamlText);
  return compileDsl(doc, options);
}
