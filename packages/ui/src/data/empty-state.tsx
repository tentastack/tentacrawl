'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center border-2 border-ink bg-surface px-8 py-10 text-center shadow-brutal-sm',
        className,
      )}
    >
      {icon && (
        <div className="mb-5 flex items-center justify-center text-brand">{icon}</div>
      )}
      <h3 className="text-lg font-black uppercase tracking-tight text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
