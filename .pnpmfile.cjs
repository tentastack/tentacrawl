const fs = require('node:fs');
const path = require('node:path');

// modules.config.ts is TypeScript, and this hook runs before any dependency
// (including typescript) is guaranteed to be installed, so it is matched
// textually. Comments are stripped first so a commented-out module entry is
// not treated as enabled.
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function readModulePackages() {
  const configPath = path.join(__dirname, 'modules.config.ts');
  if (!fs.existsSync(configPath)) return [];
  const content = stripComments(fs.readFileSync(configPath, 'utf-8'));
  const matches = content.matchAll(
    /\{\s*id:\s*'([^']+)',\s*package:\s*'([^']+)'\s*\}/g,
  );
  return [...matches].map((m) => m[2]);
}

function readRootSpecs() {
  const rootPkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'),
  );
  return { ...rootPkg.devDependencies, ...rootPkg.dependencies };
}

function isWorkspacePackage(pkgName) {
  const dirName = pkgName.replace('@tentacrawl/', '');
  return fs.existsSync(path.join(__dirname, 'packages', dirName, 'package.json'));
}

// A relative file:/link: spec resolves against whichever package declares it,
// so the root's own spec would point somewhere else once copied into apps/*.
function absolutizePathSpec(spec) {
  const match = /^(file|link):(.+)$/.exec(spec);
  if (!match || path.isAbsolute(match[2])) return spec;
  return `${match[1]}:${path.resolve(__dirname, match[2])}`;
}

// An in-repo module links through the workspace. An external one is installed
// once at the root, and each app that consumes it is given that same spec:
// pnpm resolves a package's peer dependencies from the context of whoever
// depends on it, so the copy under apps/web is what lets a module's frontend
// resolve react and @tentacrawl/ui.
const rootSpecs = readRootSpecs();
const MODULE_SPECS = readModulePackages()
  .map((pkgName) => [
    pkgName,
    isWorkspacePackage(pkgName)
      ? 'workspace:*'
      : rootSpecs[pkgName] && absolutizePathSpec(rootSpecs[pkgName]),
  ])
  .filter(([, spec]) => Boolean(spec));

const INJECT_INTO = new Set([
  '@tentacrawl/api',
  '@tentacrawl/worker',
  '@tentacrawl/web',
]);

function readPackage(pkg) {
  if (INJECT_INTO.has(pkg.name)) {
    pkg.dependencies = pkg.dependencies || {};
    for (const [modPkg, spec] of MODULE_SPECS) {
      if (!pkg.dependencies[modPkg]) {
        pkg.dependencies[modPkg] = spec;
      }
    }
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
