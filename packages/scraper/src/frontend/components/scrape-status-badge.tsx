'use client';

import { Badge } from '@tentacrawl/ui';
import type { TaskStatus } from '../../data/schemas';

const statusVariant: Record<TaskStatus, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
  PENDING: 'secondary',
  PROCESSING: 'warning',
  COMPLETED: 'success',
  FAILED: 'destructive',
};

export function ScrapeStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant={statusVariant[status] ?? 'default'} weight="brutal">
      {status}
    </Badge>
  );
}
