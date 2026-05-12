'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const panelVariants = cva('bg-surface border shadow-brutal-sm', {
  variants: {
    variant: {
      default: 'border-ink/10',
      brutal: 'border-ink',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const panelHeaderVariants = cva('px-5 py-4 border-b', {
  variants: {
    variant: {
      default: 'border-ink/10',
      brutal: 'border-ink bg-base',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

type PanelProps = React.ComponentProps<'section'> & VariantProps<typeof panelVariants>;

type PanelHeaderProps = React.ComponentProps<'div'> & VariantProps<typeof panelHeaderVariants>;

function Panel({ className, variant, ...props }: PanelProps) {
  return (
    <section
      data-slot="panel"
      className={cn(panelVariants({ variant }), className)}
      {...props}
    />
  );
}

function PanelHeader({ className, variant, ...props }: PanelHeaderProps) {
  return (
    <div
      data-slot="panel-header"
      className={cn(panelHeaderVariants({ variant }), className)}
      {...props}
    />
  );
}

function PanelTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2
      data-slot="panel-title"
      className={cn('font-bold text-sm uppercase tracking-wider', className)}
      {...props}
    />
  );
}

function PanelContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="panel-content"
      className={cn('p-5', className)}
      {...props}
    />
  );
}

export { Panel, PanelHeader, PanelTitle, PanelContent };
export type { PanelProps, PanelHeaderProps };
