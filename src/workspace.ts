/**
 * Remove me.
 */

import * as fs from 'fs';
import * as path from 'path';

export type Dict<T> = { [key: string]: T };

export interface PkgJson {
  name: string;
  dependencies: Dict<string>;
}

export type Packages = Dict<{
  path: string;
  json: PkgJson;
}>;

/**
 * Given a path, it returns paths to package.json files of all packages,
 * and the package JSONs themselves.
 */
export function listPkgs(pkgRoot: string) {
  const filesAndDirs = fs.readdirSync(pkgRoot);
  const packages: Packages = {};
  filesAndDirs.forEach(f => {
    const isDir = fs.lstatSync(path.resolve(pkgRoot, f)).isDirectory();
    const hasPkgJson = fs.existsSync(path.resolve(pkgRoot, f, 'package.json'));
    if (isDir) {
      if (!hasPkgJson) {
        console.warn(`Warning: ${f} is a directory, but has no package.json`);
        return;
      }
      const pkgJsonPath = path.resolve(pkgRoot, f, 'package.json');
      packages[f] = {
        path: pkgJsonPath,
        json: JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')),
      };
    }
  });
  return packages;
}
