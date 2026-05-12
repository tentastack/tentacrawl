'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { Panel, PanelContent } from '../primitives/panel';

type Trend = 'up' | 'down' | 'neutral';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  trend?: Trend;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

const statCardVariants = cva('', {
  variants: {
    variant: {
      default: '',
      brutal: 'border-ink',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const trendColor: Record<Trend, string> = {
  up: 'text-emerald-600',
  down: 'text-brand',
  neutral: 'text-muted',
};

function StatCard({
  label,
  value,
  change,
  trend = 'neutral',
  icon: Icon,
  className,
  variant = 'default',
}: StatCardProps & VariantProps<typeof statCardVariants>) {
  return (
    <Panel className={cn(statCardVariants({ variant }), className)} variant={variant === 'brutal' ? 'brutal' : 'default'}>
      <PanelContent>
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            {label}
          </p>
          {Icon && <Icon className="size-4 text-muted" />}
        </div>
        <p className="text-3xl font-extrabold tracking-tight mt-2">{value}</p>
        {change && (
          <p className={cn('text-sm font-semibold mt-1', trendColor[trend])}>
            {change}{' '}
            <span className="text-muted font-medium text-xs">vs last week</span>
          </p>
        )}
      </PanelContent>
    </Panel>
  );
}

export { StatCard };
export type { StatCardProps, Trend };
