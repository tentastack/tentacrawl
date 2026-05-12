'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export interface SidebarNavItem {
  label: string;
  path?: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  order?: number;
  group?: string;
  children?: SidebarNavItemChild[];
  defaultExpanded?: boolean;
}

interface SidebarNavItemChild {
  label: string;
  href: string;
}

interface SidebarFooterItem {
  href: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

type SidebarEntry = {
  item: SidebarNavItem;
  showGroupLabel: boolean;
};

interface SidebarProps {
  items: SidebarNavItem[];
  open?: boolean;
  onClose?: () => void;
  footer?: SidebarFooterItem;
  className?: string;
}

function getItemHref(item: SidebarNavItem) {
  return item.href ?? item.path;
}

function renderSidebarIcon(icon: SidebarNavItem['icon']) {
  if (!icon) {
    return null;
  }

  if (React.isValidElement(icon)) {
    return icon;
  }

  if (typeof icon === 'function' || typeof icon === 'object') {
    return React.createElement(icon as React.ElementType, { className: 'w-4 h-4' });
  }

  return null;
}

function Sidebar({ items, open = true, onClose, footer, className }: SidebarProps) {
  const pathname = usePathname();
  const sortedItems = React.useMemo(
    () => [...items].sort((left, right) => (left.order ?? 0) - (right.order ?? 0)),
    [items],
  );
  const defaultExpandedItems = React.useMemo(
    () => sortedItems
      .filter((item) => item.children?.length && item.defaultExpanded !== false)
      .map((item) => item.label),
    [sortedItems],
  );
  const [expandedItems, setExpandedItems] = React.useState<string[]>(defaultExpandedItems);

  React.useEffect(() => {
    setExpandedItems(defaultExpandedItems);
  }, [defaultExpandedItems]);

  const entries = React.useMemo<SidebarEntry[]>(() => {
    let previousGroup: string | undefined;

    return sortedItems.map((item) => {
      const showGroupLabel = Boolean(item.group && item.group !== previousGroup);
      previousGroup = item.group;

      return { item, showGroupLabel };
    });
  }, [sortedItems]);

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label],
    );
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const isParentActive = (item: SidebarNavItem) =>
    item.children?.some((child) => pathname === child.href) ?? false;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink/20 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-16 z-40 flex h-[calc(100vh-4rem)] w-60 flex-shrink-0 flex-col overflow-hidden border-r border-ink/10 bg-surface transition-transform duration-200 ease-in-out md:sticky md:top-0',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          className,
        )}
      >
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4">
          {entries.map(({ item, showGroupLabel }, index) => {
            const href = getItemHref(item);
            const hasChildren = item.children && item.children.length > 0;
            const expanded = expandedItems.includes(item.label);
            const active = href ? isActive(href) : isParentActive(item);
            const subMenuId = `sidebar-submenu-${index}`;

            return (
              <React.Fragment key={item.label}>
                {showGroupLabel ? (
                  <div className="px-2 pt-5 pb-2">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted">
                      {item.group}
                    </p>
                  </div>
                ) : null}
                <div>
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.label)}
                      aria-expanded={expanded}
                      aria-controls={subMenuId}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 rounded-sm px-2.5 py-2 text-[13px] font-medium tracking-wide transition-colors',
                        active
                          ? 'bg-base/60 text-foreground'
                          : 'text-muted-foreground hover:bg-base/40 hover:text-foreground',
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <span className={cn(
                          'flex size-7 items-center justify-center border transition-colors',
                          active
                            ? 'border-ink/20 bg-foreground text-background'
                            : 'border-ink/10 bg-base text-muted',
                        )}>
                          {renderSidebarIcon(item.icon)}
                        </span>
                        {item.label}
                      </span>
                      <ChevronRight
                        className={cn('w-3 h-3 text-muted transition-transform', expanded && 'rotate-90')}
                      />
                    </button>
                  ) : href ? (
                    <Link
                      href={href}
                      className={cn(
                        'flex items-center gap-3 rounded-sm px-2.5 py-2 text-[13px] font-medium tracking-wide transition-colors',
                        isActive(href)
                          ? 'bg-base/60 text-foreground'
                          : 'text-muted-foreground hover:bg-base/40 hover:text-foreground',
                      )}
                    >
                      <span className={cn(
                        'flex size-7 items-center justify-center border transition-colors',
                        isActive(href)
                          ? 'border-ink/20 bg-foreground text-background'
                          : 'border-ink/10 bg-base text-muted',
                      )}>
                        {renderSidebarIcon(item.icon)}
                      </span>
                      {item.label}
                    </Link>
                  ) : null}

                  {hasChildren && expanded ? (
                    <div id={subMenuId} className="ml-[1.375rem] mt-1 space-y-0.5 border-l border-ink/10 pl-4">
                      {item.children!.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            'block rounded-sm px-2.5 py-1.5 text-[13px] transition-colors',
                            isActive(child.href)
                              ? 'bg-base/60 font-semibold text-foreground'
                              : 'font-medium text-muted-foreground hover:bg-base/40 hover:text-foreground',
                          )}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </React.Fragment>
            );
          })}
        </nav>

        {footer ? (
          <div className="mt-auto flex-shrink-0 border-t border-ink/10 bg-surface p-4">
            <a href={footer.href} className="flex items-center gap-3 group">
              <div className="flex h-9 w-9 items-center justify-center border border-ink/15 bg-base text-muted transition-colors group-hover:border-brand/40 group-hover:text-brand">
                {footer.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate group-hover:text-brand transition-colors">{footer.label}</p>
                {footer.description ? <p className="text-xs text-muted truncate">{footer.description}</p> : null}
              </div>
            </a>
          </div>
        ) : null}
      </aside>
    </>
  );
}

export { Sidebar };
export type { SidebarProps, SidebarNavItemChild, SidebarFooterItem };
