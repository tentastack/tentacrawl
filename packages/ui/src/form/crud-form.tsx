'use client';

import * as React from 'react';
import type { z } from 'zod';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from '../primitives/button';
import { Input } from '../primitives/input';
import { Textarea } from '../primitives/textarea';
import { Label } from '../primitives/label';
import { Switch } from '../primitives/switch';
import { Checkbox } from '../primitives/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../primitives/select';
import { Spinner } from '../primitives/spinner';

export type CrudFieldType =
  | 'text'
  | 'url'
  | 'number'
  | 'email'
  | 'password'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'switch'
  | 'checkbox'
  | 'custom';

export interface CrudFieldOption {
  label: string;
  value: string;
  description?: string;
}

export interface CrudField {
  name: string;
  label: string;
  type: CrudFieldType;
  hideLabel?: boolean;
  sectionTitle?: string;
  sectionDescription?: string;
  sectionDividerBefore?: boolean;
  placeholder?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  defaultValue?: unknown;
  options?: CrudFieldOption[];
  render?: (props: {
    value: unknown;
    onChange: (value: unknown) => void;
    error?: string;
  }) => React.ReactNode;
}

export interface CrudFormGroup {
  title: string;
  description?: string;
  fields: string[];
  collapsible?: boolean;
}

function getFieldContainerClass(field: CrudField): string {
  if (
    field.type === 'custom'
    || field.type === 'textarea'
    || field.type === 'multiselect'
    || field.type === 'switch'
    || field.type === 'checkbox'
  ) {
    return 'md:col-span-2';
  }

  return field.type === 'url' ? 'md:col-span-2' : '';
}

interface CrudFormProps {
  fields: CrudField[];
  groups?: CrudFormGroup[];
  schema?: z.ZodType;
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  embedded?: boolean;
  isSubmitting?: boolean;
  className?: string;
}

function CrudForm({
  fields,
  groups,
  schema,
  initialValues = {},
  onSubmit,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  onCancel,
  embedded = false,
  isSubmitting = false,
  className,
}: CrudFormProps) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [hoveredMultiselectOption, setHoveredMultiselectOption] = React.useState<
    Record<string, CrudFieldOption | undefined>
  >({});
  const [values, setValues] = React.useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const field of fields) {
      init[field.name] =
        initialValues[field.name] ?? field.defaultValue ?? getFieldDefault(field.type);
    }
    return init;
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const focusField = React.useCallback((name: string) => {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const fieldContainer = form.querySelector<HTMLElement>(`[data-field-name="${name}"]`);
    if (!fieldContainer) {
      return;
    }

    const details = fieldContainer.closest('details');
    if (details && !details.open) {
      details.open = true;
    }

    fieldContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const focusTarget = fieldContainer.querySelector<HTMLElement>([
      'input:not([type="hidden"]):not([disabled])',
      'textarea:not([disabled])',
      'button[role="combobox"]:not([disabled])',
      'button:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ')) ?? fieldContainer;

    if (focusTarget === fieldContainer && !fieldContainer.hasAttribute('tabindex')) {
      fieldContainer.tabIndex = -1;
    }

    focusTarget.focus({ preventScroll: true });
  }, []);

  const renderErrorBadge = (error?: string) => {
    if (!error) {
      return null;
    }

    return (
      <p className="inline-flex w-fit max-w-full border border-destructive bg-destructive px-2 py-1.5 text-xs font-bold leading-tight text-white shadow-[2px_2px_0_0_var(--color-ink)]">
        {error}
      </p>
    );
  };

  const setValue = React.useCallback((name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrors({});

      if (schema) {
        const result = schema.safeParse(values);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          for (const issue of result.error.issues) {
            const path = issue.path.join('.');
            if (!fieldErrors[path]) {
              fieldErrors[path] = issue.message;
            }

            const topLevelPath = issue.path[0];
            if (typeof topLevelPath === 'string' && !fieldErrors[topLevelPath]) {
              fieldErrors[topLevelPath] = issue.message;
            }
          }

          const firstErrorName = fields.find((field) => fieldErrors[field.name])?.name
            ?? Object.keys(fieldErrors)[0];

          setErrors(fieldErrors);

          if (firstErrorName) {
            requestAnimationFrame(() => focusField(firstErrorName));
          }

          return;
        }
        await onSubmit(result.data as Record<string, unknown>);
      } else {
        await onSubmit(values);
      }
    },
    [values, schema, onSubmit],
  );

  // keyboard: Cmd/Ctrl+Enter to submit
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        const form = document.querySelector<HTMLFormElement>('[data-slot="crud-form"]');
        form?.requestSubmit();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const renderField = (field: CrudField) => {
    const error = errors[field.name];
    const value = values[field.name];
    const containerClassName = cn('space-y-2', getFieldContainerClass(field));

    if (field.type === 'custom' && field.render) {
      return (
        <div key={field.name} data-field-name={field.name} className={containerClassName}>
          {!field.hideLabel ? (
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="ml-1 text-destructive">*</span>}
            </Label>
          ) : null}
          {field.render({ value, onChange: (v) => setValue(field.name, v), error })}
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
        </div>
      );
    }

    if (field.type === 'switch') {
      return (
        <div key={field.name} data-field-name={field.name} className={containerClassName}>
          <div className="flex items-center justify-between border border-ink bg-surface p-4 shadow-brutal-sm">
            <div className="space-y-0.5">
              <Label htmlFor={field.name}>{field.label}</Label>
              {field.description && (
                <p className="text-xs text-muted-foreground">{field.description}</p>
              )}
            </div>
            <Switch
              id={field.name}
              checked={Boolean(value)}
              onCheckedChange={(checked) => setValue(field.name, checked)}
              disabled={field.disabled}
            />
          </div>
          {renderErrorBadge(error)}
        </div>
      );
    }

    if (field.type === 'checkbox') {
      return (
        <div key={field.name} data-field-name={field.name} className={containerClassName}>
          <div className="flex items-center gap-2">
            <Checkbox
              id={field.name}
              checked={Boolean(value)}
              onCheckedChange={(checked) => setValue(field.name, checked)}
              disabled={field.disabled}
            />
            <Label htmlFor={field.name}>{field.label}</Label>
          </div>
          {renderErrorBadge(error)}
        </div>
      );
    }

    if (field.type === 'select' && field.options) {
      return (
        <div key={field.name} data-field-name={field.name} className={containerClassName}>
          <Label htmlFor={field.name}>
            {field.label}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </Label>
          <Select
            value={String(value ?? '')}
            onValueChange={(v) => setValue(field.name, v)}
            disabled={field.disabled}
          >
            <SelectTrigger id={field.name} aria-invalid={Boolean(error)}>
              <SelectValue placeholder={field.placeholder ?? `Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
          {renderErrorBadge(error)}
        </div>
      );
    }

    if (field.type === 'multiselect' && field.options) {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      const activeOption = hoveredMultiselectOption[field.name];
      return (
        <div key={field.name} data-field-name={field.name} className={containerClassName}>
          <Label>
            {field.label}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </Label>
          <div className="flex flex-wrap gap-2">
            {field.options.map((opt) => {
              const isSelected = selected.includes(opt.value);
              return (
                <Button
                  key={opt.value}
                  type="button"
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    const next = isSelected
                      ? selected.filter((v) => v !== opt.value)
                      : [...selected, opt.value];
                    setValue(field.name, next);
                  }}
                  onMouseEnter={() => {
                    setHoveredMultiselectOption((prev) => ({ ...prev, [field.name]: opt }));
                  }}
                  onMouseLeave={() => {
                    setHoveredMultiselectOption((prev) => ({ ...prev, [field.name]: undefined }));
                  }}
                  onFocus={() => {
                    setHoveredMultiselectOption((prev) => ({ ...prev, [field.name]: opt }));
                  }}
                  onBlur={() => {
                    setHoveredMultiselectOption((prev) => ({ ...prev, [field.name]: undefined }));
                  }}
                  disabled={field.disabled}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
          {activeOption?.description ? (
            <p className="text-xs text-muted-foreground">{activeOption.description}</p>
          ) : field.description ? (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          ) : null}
          {renderErrorBadge(error)}
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.name} data-field-name={field.name} className={containerClassName}>
          <Label htmlFor={field.name}>
            {field.label}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </Label>
          <Textarea
            id={field.name}
            placeholder={field.placeholder}
            value={String(value ?? '')}
            onChange={(e) => setValue(field.name, e.target.value)}
            disabled={field.disabled}
            aria-invalid={Boolean(error)}
          />
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
          {renderErrorBadge(error)}
        </div>
      );
    }

    // text, url, number, email, password
    return (
      <div key={field.name} data-field-name={field.name} className={containerClassName}>
        <Label htmlFor={field.name}>
          {field.label}
          {field.required && <span className="ml-1 text-destructive">*</span>}
        </Label>
        <Input
          id={field.name}
          type={field.type === 'url' ? 'url' : field.type}
          placeholder={field.placeholder}
          value={field.type === 'number' ? (value as number) ?? '' : String(value ?? '')}
          onChange={(e) => {
            const raw = e.target.value;
            setValue(
              field.name,
              field.type === 'number' ? (raw === '' ? undefined : Number(raw)) : raw,
            );
          }}
          disabled={field.disabled}
          aria-invalid={Boolean(error)}
        />
        {field.description && (
          <p className="text-xs text-muted-foreground">{field.description}</p>
        )}
        {renderErrorBadge(error)}
      </div>
    );
  };

  // group fields or render flat
  const renderFields = () => {
    if (groups && groups.length > 0) {
      const renderedNames = new Set<string>();

      const renderGroupContent = (groupFields: CrudField[]) => {
        const content: React.ReactNode[] = [];

        for (const field of groupFields) {
          if (field.sectionTitle) {
            content.push(
              <div key={`${field.name}-section`} className="space-y-1 border-t border-ink/10 pt-4 first:border-t-0 first:pt-0 md:col-span-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                  {field.sectionTitle}
                </h4>
                {field.sectionDescription ? (
                  <p className="text-xs text-muted-foreground">{field.sectionDescription}</p>
                ) : null}
              </div>,
            );
          } else if (field.sectionDividerBefore) {
            content.push(
              <div key={`${field.name}-divider`} className="border-t border-ink/10 pt-1 md:col-span-2" />,
            );
          }

          content.push(renderField(field));
        }

        return <div className="grid gap-4 md:grid-cols-2">{content}</div>;
      };

      const renderGroupSection = (
        group: CrudFormGroup,
        groupFields: CrudField[],
        index: number,
      ) => {
        const content = renderGroupContent(groupFields);
        const groupErrorCount = groupFields.filter((field) => Boolean(errors[field.name])).length;

        const header = (
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="flex size-6 items-center justify-center border border-ink bg-brand font-mono text-sm font-bold leading-none text-white">
                {index + 1}
              </span>
              <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
              {groupErrorCount > 0 ? (
                <span className="rounded-sm border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">
                  {groupErrorCount} issue{groupErrorCount > 1 ? 's' : ''}
                </span>
              ) : null}
            </div>
            {group.description ? (
              <p className="text-xs text-muted-foreground">{group.description}</p>
            ) : null}
          </div>
        );

        const wrapperClassName = 'space-y-4 border-l-2 border-ink/20 pl-5';

        if (group.collapsible) {
          return (
            <details key={group.title} className={wrapperClassName}>
              <summary className="cursor-pointer list-none">
                <div className="flex items-start justify-between gap-4">
                  {header}
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span>Optional</span>
                    <ChevronDown className="size-4" />
                  </div>
                </div>
              </summary>
              <div className="pt-4">
                {content}
              </div>
            </details>
          );
        }

        return (
          <section key={group.title} className={wrapperClassName}>
            {header}
            {content}
          </section>
        );
      };

      return (
        <>
          {groups.map((group, index) => {
            const groupFields = group.fields
              .map((name) => fields.find((f) => f.name === name))
              .filter((field): field is CrudField => Boolean(field));

            groupFields.forEach((field) => renderedNames.add(field.name));
            return renderGroupSection(group, groupFields, index);
          })}
          {/* render ungrouped fields */}
          {fields
            .filter((f) => !renderedNames.has(f.name))
            .length > 0 ? (
            <section className="space-y-4 border-l-2 border-ink/20 pl-5">
              <div className="grid gap-4 md:grid-cols-2">
                {fields
                  .filter((f) => !renderedNames.has(f.name))
                  .map((field) => renderField(field))}
              </div>
            </section>
          ) : null}
        </>
      );
    }

    return <div className="grid gap-4 md:grid-cols-2">{fields.map((field) => renderField(field))}</div>;
  };

  return (
    <form
      ref={formRef}
      data-slot="crud-form"
      onSubmit={handleSubmit}
      className={cn('space-y-6', className)}
    >
      <div className="space-y-7">
        {renderFields()}
      </div>
      <div
        className={cn(
          'flex items-center gap-2',
          embedded ? 'justify-end' : 'justify-end border-t pt-4',
        )}
      >
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Spinner className="mr-2" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function getFieldDefault(type: CrudFieldType): unknown {
  switch (type) {
    case 'custom':
      return undefined;
    case 'switch':
    case 'checkbox':
      return false;
    case 'number':
      return undefined;
    case 'multiselect':
      return [];
    default:
      return '';
  }
}

export { CrudForm };
