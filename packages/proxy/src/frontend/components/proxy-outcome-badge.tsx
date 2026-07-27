'use client';

import { Badge } from '@tentacrawl/ui';
import type { RunOutcome } from '@tentacrawl/core';

const outcomeVariant: Record<RunOutcome, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
  OK: 'success',
  ERROR: 'destructive',
  BLOCKED: 'warning',
  PRECONDITION_FAILED: 'warning',
};

export function ProxyOutcomeBadge({ outcome }: { outcome?: RunOutcome }) {
  if (!outcome) {
    return (
      <Badge variant="outline" weight="brutal">
        RUNNING
      </Badge>
    );
  }

  return (
    <Badge variant={outcomeVariant[outcome] ?? 'default'} weight="brutal">
      {outcome}
    </Badge>
  );
}
