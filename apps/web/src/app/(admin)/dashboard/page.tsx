'use client';

import { DashboardPage } from '@tentacrawl/admin/frontend';
import { resolveActivityHref } from '../entity-link-resolver';

export default function DashboardRoute() {
  return <DashboardPage resolveActivityHref={resolveActivityHref} />;
}
