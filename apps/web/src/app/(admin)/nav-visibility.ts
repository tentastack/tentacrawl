import type { SidebarNavItem } from '@tentacrawl/ui';
import { moduleRoutes } from '../../generated/routes';

// maps a nav entry's first path segment to its owning module, e.g. '/proxy' -> 'proxy'
const segmentToModule = new Map<string, string>(
  moduleRoutes.map((route) => [route.path.split('/')[0], route.module]),
);

function moduleForHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const segment = href.replace(/^\//, '').split('/')[0];
  return segmentToModule.get(segment);
}

export interface ExtensionEnabledState {
  moduleId: string;
  enabled: boolean;
}

// hidden only when a module has extensions and all of them are disabled
export function disabledModuleIds(
  extensions: ExtensionEnabledState[],
): Set<string> {
  const anyEnabled = new Map<string, boolean>();
  for (const ext of extensions) {
    anyEnabled.set(ext.moduleId, (anyEnabled.get(ext.moduleId) ?? false) || ext.enabled);
  }

  const disabled = new Set<string>();
  for (const [moduleId, enabled] of anyEnabled) {
    if (!enabled) disabled.add(moduleId);
  }
  return disabled;
}

// a parent with its own page stays even if all its children are removed
export function filterNavByEnabled(
  items: SidebarNavItem[],
  disabled: Set<string>,
): SidebarNavItem[] {
  if (disabled.size === 0) return items;

  return items
    .filter((item) => {
      const moduleId = moduleForHref(item.href ?? item.path);
      return !(moduleId && disabled.has(moduleId));
    })
    .map((item) => {
      if (!item.children) return item;
      const children = item.children.filter((child) => {
        const moduleId = moduleForHref(child.href);
        return !(moduleId && disabled.has(moduleId));
      });
      return { ...item, children };
    });
}
