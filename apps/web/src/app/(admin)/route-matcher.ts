import type { ComponentType, LazyExoticComponent } from 'react';
import { pageRegistry } from '../../generated/page-registry';

export interface ResolvedRoute {
  Component: LazyExoticComponent<ComponentType<{ id?: string }>>;
  params: Record<string, string>;
}

export function resolveModulePage(segments: string[]): ResolvedRoute | null {
  const path = segments.join('/');

  for (const entry of pageRegistry) {
    const params = matchPattern(entry.path, path);
    if (params) {
      return { Component: entry.Component, params };
    }
  }
  return null;
}

function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];
    if (patternPart.startsWith(':')) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      return null;
    }
  }
  return params;
}
