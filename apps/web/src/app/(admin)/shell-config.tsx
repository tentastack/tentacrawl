import type {
  AppShellBrand,
  AppShellHeaderAction,
  SidebarFooterItem,
  SidebarNavItem,
} from '@tentacrawl/ui';
import { navigationItems } from '../../generated/navigation';
import { moduleRoutes } from '../../generated/routes';
import {
  FileText,
  Github,
  LifeBuoy,
} from 'lucide-react';

const dashboardBrand: AppShellBrand = {
  href: '/',
  mark: (
    <div className="w-6 h-6 bg-brand text-white flex items-center justify-center font-bold font-mono text-sm leading-none border border-ink">
      T
    </div>
  ),
  name: 'Tentacrawl.',
  badge: 'Admin',
};

const dashboardHeaderActions: AppShellHeaderAction[] = [
  {
    href: 'https://docs.tentacrawl.com',
    icon: <FileText className="w-4 h-4" />,
    label: 'Documentation',
    compactLabel: 'Doc',
    variant: 'outline',
  },
  {
    href: 'https://github.com/tentastack/tentacrawl',
    icon: <Github className="w-4 h-4" />,
    label: 'GitHub',
    variant: 'solid',
  },
];

const implementedModuleRoots = new Set(
  moduleRoutes.map((route) => `/${route.path.split('/')[0]}`),
);

const dashboardSidebarItems: SidebarNavItem[] = navigationItems.filter((item) => item.path ? implementedModuleRoots.has(item.path) : false);

const dashboardSidebarFooter: SidebarFooterItem = {
  href: 'mailto:support@tentacrawl.com',
  label: 'Support',
  description: 'support@tentacrawl.com',
  icon: <LifeBuoy className="w-4 h-4" />,
};

export {
  dashboardBrand,
  dashboardHeaderActions,
  dashboardSidebarFooter,
  dashboardSidebarItems,
};
