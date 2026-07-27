'use client';

import { Suspense, use } from 'react';
import { notFound } from 'next/navigation';
import { Spinner } from '@tentacrawl/ui';
import { resolveModulePage } from '../route-matcher';

interface CatchAllProps {
  params: Promise<{ segments?: string[] }>;
}

export default function ModuleCatchAllRoute({ params }: CatchAllProps) {
  const { segments } = use(params);
  const resolved = resolveModulePage(segments ?? []);

  if (!resolved) {
    notFound();
  }

  const { Component, params: routeParams } = resolved;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[280px] items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <Component {...routeParams} />
    </Suspense>
  );
}
