const fs = require('node:fs');
const path = require('node:path');

function readModulePackages() {
  const configPath = path.join(__dirname, 'modules.config.ts');
  if (!fs.existsSync(configPath)) return [];
  const content = fs.readFileSync(configPath, 'utf-8');
  const matches = content.matchAll(
    /\{\s*id:\s*'([^']+)',\s*package:\s*'([^']+)'\s*\}/g,
  );
  return [...matches].map((m) => m[2]);
}

const MODULE_PACKAGES = readModulePackages();
const INJECT_INTO = new Set(['@tentacrawl/api', '@tentacrawl/worker']);

function readPackage(pkg) {
  if (INJECT_INTO.has(pkg.name)) {
    for (const modPkg of MODULE_PACKAGES) {
      if (!pkg.dependencies[modPkg]) {
        pkg.dependencies[modPkg] = 'workspace:*';
      }
    }
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
