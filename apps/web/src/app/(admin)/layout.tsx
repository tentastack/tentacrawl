'use client';

import { AppShell } from '@tentacrawl/ui';
import { NotificationCenter } from '@tentacrawl/notification/frontend';
import { resolveNotificationHref } from './entity-link-resolver';
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
  return (
    <AppShell
      brand={dashboardBrand}
      headerActions={dashboardHeaderActions}
      headerContent={<NotificationCenter resolveHref={resolveNotificationHref} />}
      navItems={dashboardSidebarItems}
      sidebarFooter={dashboardSidebarFooter}
    >
      {children}
    </AppShell>
  );
}
