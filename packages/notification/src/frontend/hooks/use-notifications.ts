'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiCall, apiCallOrThrow, flash, queryWithTimeout } from '@tentacrawl/ui';
import type { NotificationItem } from '../../data/schemas';

export function useNotifications() {
  return useQuery<NotificationItem[]>({
    queryKey: ['notifications'],
    queryFn: () => queryWithTimeout(apiCallOrThrow<NotificationItem[]>('/notifications'), 'Notifications'),
    refetchInterval: 5000,
    retry: 1,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiCall<NotificationItem>(`/notifications/${id}/read`, {
        method: 'PATCH',
      });

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onSuccess: (notification) => {
      queryClient.setQueryData<NotificationItem[]>(['notifications'], (current) => {
        if (!current) {
          return current;
        }

        return current.map((item) => {
          if (item.id !== notification.id) {
            return item;
          }

          return notification;
        });
      });
    },
    onError: (error: Error) => {
      flash(error.message, 'error');
    },
  });
}
