'use client';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../primitives/select';
import { Input } from '../primitives/input';

const SELECT_ALL_VALUE = '__all__';

export interface FilterDef {
  id: string;
  label: string;
  type: 'select' | 'text';
  options?: { label: string; value: string }[];
  placeholder?: string;
  showAllOption?: boolean;
  controlClassName?: string;
}

interface FilterBarProps {
  filters: FilterDef[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  className?: string;
}

function FilterBar({ filters, values, onChange, className }: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 pb-2', className)}>
      {filters.map((filter) => {
        if (filter.type === 'select' && filter.options) {
          const normalizedOptions = filter.options.filter((opt) => opt.value !== '');

          const allEnabled = filter.showAllOption === true;

          return (
            <div key={filter.id} className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {filter.label}
              </span>
              <Select
                value={allEnabled ? (values[filter.id] || SELECT_ALL_VALUE) : values[filter.id]}
                onValueChange={(v) => onChange(filter.id, allEnabled && v === SELECT_ALL_VALUE ? '' : v)}
              >
                <SelectTrigger className={cn('h-8 w-[140px]', filter.controlClassName)}>
                  <SelectValue placeholder={filter.placeholder ?? (allEnabled ? 'All' : undefined)} />
                </SelectTrigger>
                <SelectContent>
                  {allEnabled && <SelectItem value={SELECT_ALL_VALUE}>All</SelectItem>}
                  {normalizedOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        return (
          <div key={filter.id} className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {filter.label}
            </span>
            <div className="relative">
              <Input
                className={cn('h-8 w-[180px] pr-8', filter.controlClassName)}
                placeholder={filter.placeholder}
                value={values[filter.id] ?? ''}
                onChange={(e) => onChange(filter.id, e.target.value)}
              />
              {values[filter.id] ? (
                <button
                  type="button"
                  aria-label={`Clear ${filter.label.toLowerCase()} filter`}
                  className="absolute right-1 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => onChange(filter.id, '')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { FilterBar };
