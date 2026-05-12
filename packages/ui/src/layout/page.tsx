'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

interface PageProps {
  children: React.ReactNode;
  className?: string;
}

function Page({ children, className }: PageProps) {
  return (
    <div className={cn('max-w-6xl space-y-8', className)}>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

function PageHeader({
  title,
  description,
  children,
  className,
  titleClassName,
  descriptionClassName,
}: PageHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div>
        <h1 className={cn('text-2xl font-extrabold tracking-tight', titleClassName)}>{title}</h1>
        {description && (
          <p className={cn('text-sm text-dim font-medium mt-1', descriptionClassName)}>{description}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2">{children}</div>
      )}
    </div>
  );
}

interface PageBodyProps {
  children: React.ReactNode;
  className?: string;
}

function PageBody({ children, className }: PageBodyProps) {
  return (
    <div className={cn(className)}>
      {children}
    </div>
  );
}

export { Page, PageHeader, PageBody };
export type { PageProps, PageHeaderProps, PageBodyProps };
