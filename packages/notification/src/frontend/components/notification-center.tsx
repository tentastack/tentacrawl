'use client';

import Link from 'next/link';
import * as React from 'react';
import { Bell, X } from 'lucide-react';
import { Button, Panel, PanelContent, PanelHeader, PanelTitle, Spinner, StatusDot, cn, formatTimestamp, timeAgo } from '@tentacrawl/ui';
import type { NotificationItem } from '../../data/schemas';
import { useMarkNotificationRead, useNotifications } from '../hooks/use-notifications';

function toDotStatus(status: NotificationItem['severity']) {
  switch (status) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'info';
  }
}

function formatUnreadCount(count: number) {
  if (count <= 0) {
    return null;
  }

  return count > 9 ? '9+' : String(count);
}

export interface NotificationCenterProps {
  resolveHref?: (notification: NotificationItem) => string | null;
}

export function NotificationCenter({ resolveHref }: NotificationCenterProps = {}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const hoverMarkedIdsRef = React.useRef(new Set<string>());
  const notificationsQuery = useNotifications();
  const markNotificationRead = useMarkNotificationRead();

  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const unreadLabel = formatUnreadCount(unreadCount);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  React.useEffect(() => {
    hoverMarkedIdsRef.current.clear();
  }, [notifications]);

  const handleNotificationHover = React.useCallback((notification: NotificationItem) => {
    if (notification.readAt || hoverMarkedIdsRef.current.has(notification.id)) {
      return;
    }

    hoverMarkedIdsRef.current.add(notification.id);
    markNotificationRead.mutate(notification.id, {
      onError: () => {
        hoverMarkedIdsRef.current.delete(notification.id);
      },
    });
  }, [markNotificationRead]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="relative"
        aria-label="Open notifications"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        <Bell className="size-4" />
        {unreadLabel ? (
          <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center border border-foreground bg-brand px-1 text-[10px] font-mono font-bold leading-4 text-white">
            {unreadLabel}
          </span>
        ) : null}
      </Button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[24rem] max-w-[calc(100vw-2rem)]">
          <Panel className="overflow-hidden border border-ink bg-surface shadow-brutal-sm">
            <PanelHeader className="relative border-b border-ink bg-base px-4 py-3 text-left">
              <PanelTitle className="font-mono text-sm font-bold uppercase tracking-widest text-foreground">
                Notifications
              </PanelTitle>
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none hover:bg-accent hover:text-muted-foreground"
                aria-label="Close notifications"
                onClick={() => setIsOpen(false)}
              >
                <X className="size-4" />
              </button>
            </PanelHeader>
            <PanelContent className="p-0">
              {notificationsQuery.isLoading && !notificationsQuery.data ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner className="size-6" />
                </div>
              ) : notificationsQuery.error ? (
                <div className="p-4">
                  <p className="text-sm text-destructive">{notificationsQuery.error.message}</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4">
                  <p className="text-sm text-muted">No notifications.</p>
                </div>
              ) : (
                <div className="max-h-[28rem] space-y-0 overflow-y-auto">
                  {notifications.map((notification) => {
                    const href = resolveHref?.(notification) ?? null;
                    const cardClassName = cn(
                      'block border-b border-ink/10 px-4 py-3 transition-colors last:border-b-0',
                      notification.readAt
                        ? 'bg-surface hover:bg-base'
                        : 'bg-brand/5 hover:bg-brand/8',
                      href ? 'cursor-pointer' : 'cursor-default',
                    );

                    const content = (
                      <div
                        className={cardClassName}
                        onMouseEnter={() => handleNotificationHover(notification)}
                      >
                        <div className="flex items-start gap-2">
                          <div>
                            <StatusDot status={toDotStatus(notification.severity)} size="md" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-start justify-between gap-2">
                              <p className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">{notification.title}</p>
                              {!notification.readAt ? (
                                <span className="shrink-0 border border-ink/70 bg-base px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-foreground">
                                  New
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm leading-5 text-muted">{notification.message}</p>
                            <div className="flex items-center gap-2 pt-1">
                              <span
                                className="text-xs font-mono lowercase tracking-normal text-muted/80"
                                title={formatTimestamp(notification.createdAt)}
                              >
                                {timeAgo(notification.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );

                    return href ? (
                      <Link
                        key={notification.id}
                        href={href}
                        onClick={() => setIsOpen(false)}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div key={notification.id}>
                        {content}
                      </div>
                    );
                  })}
                </div>
              )}
            </PanelContent>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
