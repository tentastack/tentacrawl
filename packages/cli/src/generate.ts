import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
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

  const initializer = findExportedInitializer(
    parseSource(configPath),
    'enabledModules',
  );
  if (!initializer || !ts.isArrayLiteralExpression(initializer)) {
    console.warn('modules.config.ts has no enabledModules array literal; nothing to generate.');
    return [];
  }

  const value = evaluateNode(initializer);
  if (!Array.isArray(value)) return [];

  const entries: ModuleEntry[] = [];
  for (const item of value) {
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      if (typeof record.id === 'string' && typeof record.package === 'string') {
        entries.push({ id: record.id, package: record.package });
      }
    }
  }
  return entries;
}

// read statically, never executed: any literal object literal survives format/quote variation
function parseSource(filePath: string): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf-8'),
    ts.ScriptTarget.Latest,
    true,
  );
}

function findExportedInitializer(
  source: ts.SourceFile,
  exportName: string,
): ts.Expression | undefined {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const exported = statement.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported) continue;
    for (const decl of statement.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === exportName && decl.initializer) {
        return unwrap(decl.initializer);
      }
    }
  }
  return undefined;
}

function unwrap(node: ts.Expression): ts.Expression {
  if (
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node)
  ) {
    return unwrap(node.expression);
  }
  return node;
}

// non-literal fields (identifiers, calls, templates) are skipped, not evaluated
function evaluateNode(node: ts.Expression): unknown {
  const expr = unwrap(node);
  if (ts.isStringLiteralLike(expr)) return expr.text;
  if (ts.isNumericLiteral(expr)) return Number(expr.text);
  if (expr.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expr.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (expr.kind === ts.SyntaxKind.NullKeyword) return null;
  if (
    ts.isPrefixUnaryExpression(expr) &&
    expr.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(expr.operand)
  ) {
    return -Number(expr.operand.text);
  }
  if (ts.isArrayLiteralExpression(expr)) {
    return expr.elements
      .filter((el): el is ts.Expression => !ts.isSpreadElement(el))
      .map((el) => evaluateNode(el));
  }
  if (ts.isObjectLiteralExpression(expr)) {
    const result: Record<string, unknown> = {};
    for (const prop of expr.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key = propertyName(prop.name);
      if (key === undefined) continue;
      result[key] = evaluateNode(prop.initializer);
    }
    return result;
  }
  return undefined;
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function resolveModuleSrcDir(entry: ModuleEntry): string | null {
  const pkgName = entry.package.replace('@tentacrawl/', '');
  const srcDir = path.join(WORKSPACE_ROOT, 'packages', pkgName, 'src');
  if (fs.existsSync(srcDir)) return srcDir;
  return null;
}

function loadModuleMetadata(srcDir: string): ModuleInfo | null {
  const indexPath = path.join(srcDir, 'index.ts');
  if (!fs.existsSync(indexPath)) return null;

  const initializer = findExportedInitializer(parseSource(indexPath), 'metadata');
  if (!initializer || !ts.isObjectLiteralExpression(initializer)) return null;

  const raw = evaluateNode(initializer);
  if (!raw || typeof raw !== 'object') return null;
  return normalizeMetadata(raw as Record<string, unknown>);
}

function normalizeMetadata(raw: Record<string, unknown>): ModuleInfo | null {
  const name = asString(raw.name);
  const title = asString(raw.title);
  if (!name || !title) return null;

  const info: ModuleInfo = {
    name,
    title,
    version: asString(raw.version) ?? '0.0.0',
    description: asString(raw.description) ?? '',
    requires: asStringArray(raw.requires),
    optional: asStringArray(raw.optional),
  };

  const navigation = normalizeNavigation(raw.navigation);
  if (navigation) info.navigation = navigation;

  const routes = normalizeRoutes(raw.routes);
  if (routes.length > 0) info.routes = routes;

  return info;
}

function normalizeNavigation(value: unknown): ModuleInfo['navigation'] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const nav = value as Record<string, unknown>;
  const label = asString(nav.label);
  const icon = asString(nav.icon);
  const navPath = asString(nav.path);
  const order = asNumber(nav.order);
  if (!label || !icon || !navPath || order === undefined) return undefined;

  const group = asString(nav.group);
  const parent = asString(nav.parent);
  return {
    label,
    icon,
    path: navPath,
    order,
    ...(group ? { group } : {}),
    ...(parent ? { parent } : {}),
  };
}

function normalizeRoutes(value: unknown): NonNullable<ModuleInfo['routes']> {
  if (!Array.isArray(value)) return [];
  const routes: NonNullable<ModuleInfo['routes']> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const route = entry as Record<string, unknown>;
    const rPath = asString(route.path);
    const rPage = asString(route.page);
    const rTitle = asString(route.title);
    if (rPath && rPage && rTitle) routes.push({ path: rPath, page: rPage, title: rTitle });
  }
  return routes;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
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

  const workerDir = path.join(WORKSPACE_ROOT, 'apps', 'worker', 'src', 'generated');
  const workerModulesContent = generateWorkerModules(modules);
  const workerEntitiesContent = generateEntities(modules);
  writeIfChanged(path.join(workerDir, 'modules.ts'), workerModulesContent);
  writeIfChanged(path.join(workerDir, 'entities.ts'), workerEntitiesContent);

  const apiDir = path.join(WORKSPACE_ROOT, 'apps', 'api', 'src', 'generated');
  const apiModulesContent = generateApiModules(modules);
  const apiEntitiesContent = generateEntities(modules);
  writeIfChanged(path.join(apiDir, 'modules.ts'), apiModulesContent);
  writeIfChanged(path.join(apiDir, 'entities.ts'), apiEntitiesContent);

  const webDir = path.join(WORKSPACE_ROOT, 'apps', 'web', 'src', 'generated');
  if (fs.existsSync(path.join(WORKSPACE_ROOT, 'apps', 'web'))) {
    const navigationContent = generateNavigation(modules);
    const routesContent = generateRoutes(modules);
    const pageRegistryContent = generatePageRegistry(modules);
    writeIfChanged(path.join(webDir, 'navigation.ts'), navigationContent);
    writeIfChanged(path.join(webDir, 'routes.ts'), routesContent);
    writeIfChanged(path.join(webDir, 'page-registry.ts'), pageRegistryContent);
  }

  console.log('Registry files generated.');
}

function generateNavigation(modules: ScannedModule[]): string {
  const navModules = modules.filter((m) => m.metadata.navigation);
  const rootModules = navModules.filter((m) => !m.metadata.navigation!.parent);
  const childModules = navModules.filter((m) => m.metadata.navigation!.parent);

  const lines = [
    '// AUTO-GENERATED by @tentacrawl/cli — do not edit',
    "import type { SidebarNavItem } from '@tentacrawl/ui';",
    '',
  ];

  // collect icon names from root modules (children render without icons)
  const icons = new Set<string>();
  for (const mod of rootModules) {
    icons.add(mod.metadata.navigation!.icon);
  }
  lines.push(`import { ${[...icons].join(', ')} } from 'lucide-react';`);
  lines.push('');
  lines.push('export const navigationItems: SidebarNavItem[] = [');

  for (const mod of rootModules) {
    const nav = mod.metadata.navigation!;
    const children = childModules
      .filter((child) => child.metadata.navigation!.parent === nav.path)
      .sort(
        (a, b) => a.metadata.navigation!.order - b.metadata.navigation!.order,
      );

    lines.push('  {');
    lines.push(`    label: '${nav.label}',`);
    lines.push(`    path: '${nav.path}',`);
    lines.push(`    icon: ${nav.icon},`);
    lines.push(`    order: ${nav.order},`);
    if (nav.group) {
      lines.push(`    group: '${nav.group}',`);
    }
    if (children.length > 0) {
      lines.push('    children: [');
      for (const child of children) {
        const childNav = child.metadata.navigation!;
        lines.push(`      { label: '${childNav.label}', href: '${childNav.path}' },`);
      }
      lines.push('    ],');
    }
    lines.push('  },');
  }

  const orphanChildren = childModules.filter(
    (child) =>
      !rootModules.some(
        (root) => root.metadata.navigation!.path === child.metadata.navigation!.parent,
      ),
  );
  for (const mod of orphanChildren) {
    console.warn(
      `Module '${mod.entry.id}' navigation parent '${mod.metadata.navigation!.parent}' not found; entry omitted.`,
    );
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

function pageComponentName(page: string): string {
  const base = page
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return base.endsWith('Page') ? base : `${base}Page`;
}

function generatePageRegistry(modules: ScannedModule[]): string {
  const routeModules = modules.filter(
    (m) => m.hasFrontend && m.metadata.routes && m.metadata.routes.length > 0,
  );
  const lines = [
    '// AUTO-GENERATED by @tentacrawl/cli — do not edit',
    '// @ts-nocheck',
    "import { lazy } from 'react';",
    "import type { ComponentType, LazyExoticComponent } from 'react';",
    '',
    'export interface PageRegistryEntry {',
    '  path: string;',
    '  Component: LazyExoticComponent<ComponentType<{ id?: string }>>;',
    '}',
    '',
    'export const pageRegistry: PageRegistryEntry[] = [',
  ];

  for (const mod of routeModules) {
    for (const route of mod.metadata.routes!) {
      const component = pageComponentName(route.page);
      lines.push(
        `  { path: '${route.path}', Component: lazy(() => import('${mod.entry.package}/frontend').then((m) => ({ default: m.${component} }))) },`,
      );
    }
  }

  lines.push('];');
  lines.push('');
  return lines.join('\n');
}

main();
