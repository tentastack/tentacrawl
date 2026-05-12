'use client';

import { Badge } from '@tentacrawl/ui';
import type { CrawlPageStatus } from '@tentacrawl/core/schema';

const statusVariant: Record<CrawlPageStatus, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
  PENDING: 'secondary',
  PROCESSING: 'warning',
  COMPLETED: 'success',
  FAILED: 'destructive',
  SKIPPED: 'default',
};

export function CrawlPageStatusBadge({ status }: { status: CrawlPageStatus }) {
  return (
    <Badge variant={statusVariant[status] ?? 'default'} weight="brutal">
      {status}
    </Badge>
  );
}