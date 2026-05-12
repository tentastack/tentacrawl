import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ModuleInfo } from '@tentacrawl/core';

interface ModuleEntry {
  id: string;
  package: string;
}

interface ScannedModule {
  entry: ModuleEntry;
  metadata: ModuleInfo;
  hasWorkerModule: boolean;
  hasApiModule: boolean;
  hasEntities: boolean;
  hasEvents: boolean;
  hasFrontend: boolean;
}

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..');

function loadModulesConfig(): ModuleEntry[] {
  const configPath = path.join(WORKSPACE_ROOT, 'modules.config.ts');
  if (!fs.existsSync(configPath)) {
    console.log('No modules.config.ts found, generating empty registries.');
    return [];
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  const matches = content.matchAll(
    /\{\s*id:\s*'([^']+)',\s*package:\s*'([^']+)'\s*\}/g,
  );

  const entries: ModuleEntry[] = [];
  for (const match of matches) {
    entries.push({ id: match[1], package: match[2] });
  }
  return entries;
}

function resolveModuleSrcDir(entry: ModuleEntry): string | null {
  // workspace package: @tentacrawl/foo -> packages/foo/src
  const pkgName = entry.package.replace('@tentacrawl/', '');
  const srcDir = path.join(WORKSPACE_ROOT, 'packages', pkgName, 'src');
  if (fs.existsSync(srcDir)) return srcDir;
  return null;
}

function loadModuleMetadata(srcDir: string): ModuleInfo | null {
  const indexPath = path.join(srcDir, 'index.ts');
  if (!fs.existsSync(indexPath)) return null;

  const content = fs.readFileSync(indexPath, 'utf-8');
  // parse metadata object from the file
  const metadataMatch = content.match(
    /export\s+const\s+metadata\s*:\s*ModuleInfo\s*=\s*(\{[\s\S]*?\n\});/,
  );
  if (!metadataMatch) return null;

  try {
    // simple eval-safe extraction of string fields
    const raw = metadataMatch[1];
    const name = raw.match(/name:\s*'([^']+)'/)?.[1] ?? '';
    const title = raw.match(/title:\s*'([^']+)'/)?.[1] ?? '';
    const version = raw.match(/version:\s*'([^']+)'/)?.[1] ?? '0.0.0';
    const description = raw.match(/description:\s*'([^']+)'/)?.[1] ?? '';

    const requiresMatch = raw.match(/requires:\s*\[([^\]]*)\]/);
    const requires = requiresMatch
      ? requiresMatch[1]
          .split(',')
          .map((s) => s.trim().replace(/'/g, ''))
          .filter(Boolean)
      : [];

    const optionalMatch = raw.match(/optional:\s*\[([^\]]*)\]/);
    const optional = optionalMatch
      ? optionalMatch[1]
          .split(',')
          .map((s) => s.trim().replace(/'/g, ''))
          .filter(Boolean)
      : [];

    // parse navigation block
    let navigation: ModuleInfo['navigation'] | undefined;
    const navMatch = raw.match(/navigation:\s*\{([^}]+)\}/);
    if (navMatch) {
      const navRaw = navMatch[1];
      const navLabel = navRaw.match(/label:\s*'([^']+)'/)?.[1];
      const navIcon = navRaw.match(/icon:\s*'([^']+)'/)?.[1];
      const navPath = navRaw.match(/path:\s*'([^']+)'/)?.[1];
      const navOrder = navRaw.match(/order:\s*(\d+)/)?.[1];
      const navGroup = navRaw.match(/group:\s*'([^']+)'/)?.[1];
      if (navLabel && navIcon && navPath && navOrder) {
        navigation = {
          label: navLabel,
          icon: navIcon,
          path: navPath,
          order: Number(navOrder),
          ...(navGroup ? { group: navGroup } : {}),
        };
      }
    }

    // parse routes array
    let routes: ModuleInfo['routes'] | undefined;
    const routesMatch = raw.match(/routes:\s*\[([\s\S]*?)\]/);
    if (routesMatch) {
      const routesRaw = routesMatch[1];
      const routeEntries = [...routesRaw.matchAll(/\{([^}]+)\}/g)];
      routes = routeEntries
        .map((m) => {
          const rPath = m[1].match(/path:\s*'([^']+)'/)?.[1];
          const rPage = m[1].match(/page:\s*'([^']+)'/)?.[1];
          const rTitle = m[1].match(/title:\s*'([^']+)'/)?.[1];
          if (rPath && rPage && rTitle) return { path: rPath, page: rPage, title: rTitle };
          return null;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (routes.length === 0) routes = undefined;
    }

    return { name, title, version, description, requires, optional, navigation, routes };
  } catch {
    return null;
  }
}

function scanModule(entry: ModuleEntry): ScannedModule | null {
  const srcDir = resolveModuleSrcDir(entry);
  if (!srcDir) {
    console.warn(`Module '${entry.id}' not found at expected path, skipping.`);
    return null;
  }

  const metadata = loadModuleMetadata(srcDir);
  if (!metadata) {
    console.error(
      `Module '${entry.id}' has no valid metadata export in index.ts`,
    );
    process.exit(1);
  }

  const hasWorkerModule = fileExists(srcDir, 'worker', `${entry.id}.worker-module.ts`);
  const hasApiModule = fileExists(srcDir, 'api', `${entry.id}.api-module.ts`);
  const hasEntities = fileExists(srcDir, 'data', 'entities.ts');
  const hasEvents = fs.existsSync(path.join(srcDir, 'event.ts'));
  const hasFrontend = fs.existsSync(path.join(srcDir, 'frontend'));

  return { entry, metadata, hasWorkerModule, hasApiModule, hasEntities, hasEvents, hasFrontend };
}

function fileExists(...segments: string[]): boolean {
  return fs.existsSync(path.join(...segments));
}

function validateDependencies(
  modules: ScannedModule[],
  enabledIds: Set<string>,
): void {
  for (const mod of modules) {
    for (const dep of mod.metadata.requires ?? []) {
      if (!enabledIds.has(dep)) {
        console.error(
          `Module '${mod.entry.id}' requires '${dep}', but it is not enabled in modules.config.ts`,
        );
        process.exit(1);
      }
    }
  }
}

function generateWorkerModules(modules: ScannedModule[]): string {
  const workerModules = modules.filter((m) => m.hasWorkerModule);
  const lines = [
    '// AUTO-GENERATED by @tentacrawl/cli — do not edit',
    '// @ts-nocheck',
    "import type { DynamicModule } from '@nestjs/common';",
    '',
  ];

  for (const mod of workerModules) {
    const className = pascalCase(mod.entry.id) + 'Module';
    lines.push(
      `import { ${className} } from '${mod.entry.package}';`,
    );
  }

  lines.push('');
  lines.push('export const workerModules: DynamicModule[] = [');
  for (const mod of workerModules) {
    const className = pascalCase(mod.entry.id) + 'Module';
    lines.push(`  ${className}.forWorker(),`);
  }
  lines.push('];');
  lines.push('');

  return lines.join('\n');
}

function generateApiModules(modules: ScannedModule[]): string {
  const apiModules = modules.filter((m) => m.hasApiModule);
  const lines = [
    '// AUTO-GENERATED by @tentacrawl/cli — do not edit',
    '// @ts-nocheck',
    "import type { DynamicModule } from '@nestjs/common';",
    '',
  ];

  for (const mod of apiModules) {
    const className = pascalCase(mod.entry.id) + 'Module';
    lines.push(
      `import { ${className} } from '${mod.entry.package}';`,
    );
  }

  lines.push('');
  lines.push('export const apiModules: DynamicModule[] = [');
  for (const mod of apiModules) {
    const className = pascalCase(mod.entry.id) + 'Module';
    lines.push(`  ${className}.forApi(),`);
  }
  lines.push('];');
  lines.push('');

  return lines.join('\n');
}

function generateEntities(modules: ScannedModule[]): string {
  const entityModules = modules.filter((m) => m.hasEntities);
  const lines = [
    '// AUTO-GENERATED by @tentacrawl/cli — do not edit',
    '// @ts-nocheck',
    '',
  ];

  if (entityModules.length === 0) {
    lines.push('export const MODULE_ENTITIES: unknown[] = [];');
    lines.push('');
    return lines.join('\n');
  }

  for (const mod of entityModules) {
    const alias = `${mod.entry.id}Entities`;
    lines.push(
      `import * as ${alias} from '${mod.entry.package}/data/entities';`,
    );
  }

  lines.push('');
  lines.push(
    'function collectEntities(...sources: Record<string, unknown>[]): unknown[] {',
  );
  lines.push('  const entities: unknown[] = [];');
  lines.push('  for (const source of sources) {');
  lines.push('    for (const value of Object.values(source)) {');
  lines.push(
    "      if (typeof value === 'function' && value.name) entities.push(value);",
  );
  lines.push('    }');
  lines.push('  }');
  lines.push('  return entities;');
  lines.push('}');
  lines.push('');

  const args = entityModules.map((m) => `${m.entry.id}Entities`).join(', ');
  lines.push(`export const MODULE_ENTITIES = collectEntities(${args});`);
  lines.push('');

  return lines.join('\n');
}

function pascalCase(s: string): string {
  return s
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function writeIfChanged(filePath: string, content: string): boolean {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf-8');
    if (existing === content) return false;
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
}

export function main(): void {
  console.log('Scanning modules...');
  const entries = loadModulesConfig();
  const enabledIds = new Set(entries.map((e) => e.id));

  const modules: ScannedModule[] = [];
  for (const entry of entries) {
    const scanned = scanModule(entry);
    if (scanned) modules.push(scanned);
  }

  validateDependencies(modules, enabledIds);

  console.log(
    `Found ${modules.length} module(s): ${modules.map((m) => m.entry.id).join(', ') || '(none)'}`,
  );

  // generate worker registry
  const workerDir = path.join(WORKSPACE_ROOT, 'apps', 'worker', 'src', 'generated');
  const workerModulesContent = generateWorkerModules(modules);
  const workerEntitiesContent = generateEntities(modules);
  writeIfChanged(path.join(workerDir, 'modules.ts'), workerModulesContent);
  writeIfChanged(path.join(workerDir, 'entities.ts'), workerEntitiesContent);

  // generate api registry
  const apiDir = path.join(WORKSPACE_ROOT, 'apps', 'api', 'src', 'generated');
  const apiModulesContent = generateApiModules(modules);
  const apiEntitiesContent = generateEntities(modules);
  writeIfChanged(path.join(apiDir, 'modules.ts'), apiModulesContent);
  writeIfChanged(path.join(apiDir, 'entities.ts'), apiEntitiesContent);

  // generate web (frontend) registry
  const webDir = path.join(WORKSPACE_ROOT, 'apps', 'web', 'src', 'generated');
  if (fs.existsSync(path.join(WORKSPACE_ROOT, 'apps', 'web'))) {
    const navigationContent = generateNavigation(modules);
    const routesContent = generateRoutes(modules);
    writeIfChanged(path.join(webDir, 'navigation.ts'), navigationContent);
    writeIfChanged(path.join(webDir, 'routes.ts'), routesContent);
  }

  console.log('Registry files generated.');
}

function generateNavigation(modules: ScannedModule[]): string {
  const navModules = modules.filter((m) => m.metadata.navigation);
  const lines = [
    '// AUTO-GENERATED by @tentacrawl/cli — do not edit',
    "import type { SidebarNavItem } from '@tentacrawl/ui';",
    '',
  ];

  // collect icon names from all modules
  const icons = new Set<string>();
  for (const mod of navModules) {
    icons.add(mod.metadata.navigation!.icon);
  }
  lines.push(`import { ${[...icons].join(', ')} } from 'lucide-react';`);
  lines.push('');
  lines.push('export const navigationItems: SidebarNavItem[] = [');

  for (const mod of navModules) {
    const nav = mod.metadata.navigation!;
    lines.push('  {');
    lines.push(`    label: '${nav.label}',`);
    lines.push(`    path: '${nav.path}',`);
    lines.push(`    icon: ${nav.icon},`);
    lines.push(`    order: ${nav.order},`);
    if (nav.group) {
      lines.push(`    group: '${nav.group}',`);
    }
    lines.push('  },');
  }

  lines.push('];');
  lines.push('');
  return lines.join('\n');
}

function generateRoutes(modules: ScannedModule[]): string {
  const routeModules = modules.filter((m) => m.metadata.routes && m.metadata.routes.length > 0);
  const lines = [
    '// AUTO-GENERATED by @tentacrawl/cli — do not edit',
    '',
    'export interface RouteEntry {',
    '  path: string;',
    '  module: string;',
    '  title: string;',
    '}',
    '',
    'export const moduleRoutes: RouteEntry[] = [',
  ];

  for (const mod of routeModules) {
    for (const route of mod.metadata.routes!) {
      lines.push(`  { path: '${route.path}', module: '${mod.entry.id}', title: '${route.title}' },`);
    }
  }

  lines.push('];');
  lines.push('');
  return lines.join('\n');
}

main();
