import * as fs from 'node:fs';
import * as path from 'node:path';

function readVersionField(pkgPath: string): string | undefined {
  if (!fs.existsSync(pkgPath)) return undefined;
  const version = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version;
  return typeof version === 'string' ? version : undefined;
}

// callers pass __dirname, so the walk starts inside dist/ and has to climb out.
// Workspace packages omit their version, so the walk falls through to the root
// product version; an extracted extension repo declares its own and stops there.
export function readPackageVersion(fromDir: string): string {
  const { root } = path.parse(fromDir);
  let dir = fromDir;

  for (;;) {
    const version = readVersionField(path.join(dir, 'package.json'));
    if (version) return version;
    if (dir === root) return '0.0.0';
    dir = path.dirname(dir);
  }
}
