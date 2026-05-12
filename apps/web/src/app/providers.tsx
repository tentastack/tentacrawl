'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FlashProvider, ThemeProvider, configureApiClient } from '@tentacrawl/ui';
import * as React from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

configureApiClient(API_BASE_URL);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {children}
        <FlashProvider />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
