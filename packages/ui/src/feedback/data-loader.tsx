'use client';

import * as React from 'react';
import { cn } from '../lib/utils';
import { Spinner } from '../primitives/spinner';

interface DataLoaderProps {
  isLoading: boolean;
  error?: Error | null;
  children: React.ReactNode;
  className?: string;
}

function DataLoader({ isLoading, error, children, className }: DataLoaderProps) {
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('rounded-md border border-destructive/50 bg-destructive/5 p-4', className)}>
        <p className="text-sm font-medium text-destructive">
          {error.message || 'Something went wrong'}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

export { DataLoader };
export type { DataLoaderProps };
