'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from '../primitives/button';
import { type SidebarFooterItem, type SidebarNavItem, Sidebar } from './sidebar';

interface AppShellBrand {
  href: string;
  mark: React.ReactNode;
  name: string;
  badge?: string;
}

interface AppShellSearch {
  placeholder?: string;
  shortcut?: string;
}

interface AppShellHeaderAction {
  href: string;
  icon: React.ReactNode;
  label: string;
  compactLabel?: string;
  variant?: 'outline' | 'solid';
}

interface AppShellProps {
  children: React.ReactNode;
  navItems: SidebarNavItem[];
  className?: string;
  mainClassName?: string;
  brand?: AppShellBrand;
  search?: AppShellSearch;
  headerActions?: AppShellHeaderAction[];
  headerContent?: React.ReactNode;
  sidebarFooter?: SidebarFooterItem;
}

const defaultBrand: AppShellBrand = {
  href: '/',
  mark: (
    <div className="w-6 h-6 bg-brand text-white flex items-center justify-center font-bold font-mono text-sm leading-none border border-ink">
      T
    </div>
  ),
  name: 'Tentacrawl.',
  badge: 'Admin',
};

const defaultSearch: AppShellSearch = {
  placeholder: 'Search…',
  shortcut: '⌘K',
};

function AppShell({
  children,
  navItems,
  className,
  mainClassName,
  brand = defaultBrand,
  search = defaultSearch,
  headerActions = [],
  headerContent,
  sidebarFooter,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const searchInputId = React.useId();

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');

    const handleViewportChange = () => {
      setSidebarOpen(false);
    };

    mediaQuery.addEventListener('change', handleViewportChange);

    return () => {
      mediaQuery.removeEventListener('change', handleViewportChange);
    };
  }, []);

  return (
    <div className={cn('min-h-screen bg-base bg-grid flex flex-col', className)}>
      <header className="sticky top-0 z-50 bg-base/90 backdrop-blur-sm border-b border-ink/10 h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden w-8 h-8 flex items-center justify-center border border-ink/20 hover:bg-ink/5 transition-colors"
            aria-label="Toggle sidebar"
            aria-expanded={sidebarOpen}
          >
            <Menu className="w-4 h-4" />
          </button>
          <Link href={brand.href} className="flex items-center gap-2">
            {brand.mark}
            <span className="font-extrabold text-xl tracking-tighter">
              {brand.name}
            </span>
          </Link>
          {brand.badge ? (
            <span className="text-xs font-mono font-bold text-muted border border-ink/20 px-2 py-0.5 uppercase tracking-wider">
              {brand.badge}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center border border-ink bg-surface px-3 py-1.5 gap-2 shadow-brutal-sm">
            <Search className="w-4 h-4 text-muted flex-shrink-0" />
            <label htmlFor={searchInputId} className="sr-only">Search</label>
            <input
              id={searchInputId}
              type="text"
              placeholder={search.placeholder}
              className="bg-transparent text-sm font-medium outline-none w-48 placeholder:text-muted/60"
            />
            {search.shortcut ? (
              <kbd className="text-[10px] font-mono text-muted border border-ink/10 px-1.5 py-0.5 bg-base">{search.shortcut}</kbd>
            ) : null}
          </div>

          {headerActions.map((action) => (
            <Button
              key={action.href}
              asChild
              size="sm"
              variant={action.variant === 'solid' ? 'brutal' : 'outline'}
              className={cn(action.variant === 'solid' ? 'px-4' : '')}
            >
              <a href={action.href}>
                {action.icon}
                {action.compactLabel ? <span className="lg:hidden">{action.compactLabel}</span> : null}
                <span className={action.compactLabel ? 'hidden lg:inline' : undefined}>{action.label}</span>
              </a>
            </Button>
          ))}

          {headerContent}
        </div>
      </header>

      <div className="flex flex-1 items-start">
        <Sidebar
          items={navItems}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          footer={sidebarFooter}
        />
        <main className={cn('min-w-0 flex-1 p-6 md:p-8', mainClassName)}>
          {children}
        </main>
      </div>
    </div>
  );
}

export { AppShell };
export type { AppShellProps, AppShellBrand, AppShellSearch, AppShellHeaderAction };
