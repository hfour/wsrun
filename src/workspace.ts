/**
 * Remove me.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as glob from 'glob'
import { flatMap } from 'lodash'

export type Dict<T> = { [key: string]: T }

export interface PkgJson {
  name: string
  dependencies: Dict<string>
}

export type Packages = Dict<{
  path: string
  json: PkgJson
}>

/**
 * Given a path, it returns paths to package.json files of all packages,
 * and the package JSONs themselves.
 */
export function listPkgs(wsRoot: string, globs: string[]) {
  let filesAndDirs = flatMap(globs, g => glob.sync(g))
  const packages: Packages = {}
  filesAndDirs.forEach(f => {
    const isDir = fs.lstatSync(path.resolve(wsRoot, f)).isDirectory()
    if (isDir) {
      const pkgJsonPath = path.resolve(wsRoot, f, 'package.json')
      const hasPkgJson = fs.existsSync(pkgJsonPath)
      if (!hasPkgJson) {
        console.warn(`Warning: ${f} is a directory, but has no package.json`)
        return
      }
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
      packages[pkgJson.name] = {
        path: path.join(wsRoot, f),
        json: pkgJson
      }
    }
  })
  return packages
}
