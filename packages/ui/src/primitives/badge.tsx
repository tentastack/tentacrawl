'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center border text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow-xs',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground',
        destructive:
          'border-transparent bg-destructive text-white shadow',
        outline: 'text-foreground',
        success:
          'border-transparent bg-emerald-500/15 text-emerald-500',
        warning:
          'border-transparent bg-amber-500/15 text-amber-500',
      },
      weight: {
        default: 'rounded-md px-2.5 py-0.5',
        brutal: 'rounded-none border-ink px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] shadow-brutal-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      weight: 'default',
    },
  },
);

type BadgeProps = React.ComponentProps<'div'> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, weight, ...props }: BadgeProps) {
  return (
    <div
      data-slot="badge"
      className={cn(badgeVariants({ variant, weight }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
