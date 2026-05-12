'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-[60px] w-full border border-ink bg-surface px-3 py-2 text-sm shadow-brutal-sm',
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

export { Textarea };
