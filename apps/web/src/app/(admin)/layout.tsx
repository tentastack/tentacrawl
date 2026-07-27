'use client';

import { useMemo } from 'react';
import { AppShell } from '@tentacrawl/ui';
import { NotificationCenter } from '@tentacrawl/notification/frontend';
import { useChallengers } from '@tentacrawl/challenger/frontend';
import { resolveNotificationHref } from './entity-link-resolver';
import { disabledModuleIds, filterNavByEnabled } from './nav-visibility';
import {
  dashboardBrand,
  dashboardHeaderActions,
  dashboardSidebarFooter,
  dashboardSidebarItems,
} from './shell-config';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: extensions } = useChallengers();

  const navItems = useMemo(() => {
    if (!extensions) return dashboardSidebarItems;
    return filterNavByEnabled(dashboardSidebarItems, disabledModuleIds(extensions));
  }, [extensions]);

  return (
    <AppShell
      brand={dashboardBrand}
      headerActions={dashboardHeaderActions}
      headerContent={<NotificationCenter resolveHref={resolveNotificationHref} />}
      navItems={navItems}
      sidebarFooter={dashboardSidebarFooter}
    >
      {children}
    </AppShell>
  );
}
