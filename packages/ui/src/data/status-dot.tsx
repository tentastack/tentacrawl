'use client';

import { cn } from '../lib/utils';

type DotStatus = 'success' | 'warning' | 'error' | 'info' | 'running' | 'neutral';
type DotSize = 'sm' | 'md';

interface StatusDotProps {
  status: DotStatus;
  size?: DotSize;
  bordered?: boolean;
  className?: string;
}

const dotColor: Record<DotStatus, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-ink/30',
  running: 'bg-blue-500',
  neutral: 'bg-ink/20',
};

const dotSize: Record<DotSize, string> = {
  sm: 'size-2',
  md: 'size-3',
};

function StatusDot({ status, size = 'sm', bordered = false, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        'inline-block flex-shrink-0',
        dotSize[size],
        dotColor[status],
        bordered && 'border border-ink/10',
        className,
      )}
      aria-label={status}
    />
  );
}

export { StatusDot };
export type { StatusDotProps, DotStatus, DotSize };
