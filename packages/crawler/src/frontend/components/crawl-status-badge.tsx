'use client';

import { Badge } from '@tentacrawl/ui';
import type { CrawlStatus } from '@tentacrawl/core/schema';

const statusVariant: Record<CrawlStatus, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
  PENDING: 'secondary',
  PROCESSING: 'warning',
  COMPLETED: 'success',
  FAILED: 'destructive',
  CANCELLED: 'default',
};

export function CrawlStatusBadge({ status }: { status: CrawlStatus }) {
  return (
    <Badge variant={statusVariant[status] ?? 'default'} weight="brutal">
      {status}
    </Badge>
  );
}