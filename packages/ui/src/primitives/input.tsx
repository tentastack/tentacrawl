'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full border border-ink bg-surface px-3 py-1 text-sm shadow-brutal-sm transition-colors',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-0 focus-visible:border-ink',
        'aria-invalid:border-destructive aria-invalid:shadow-none aria-invalid:[box-shadow:2px_2px_0_0_var(--color-destructive)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
