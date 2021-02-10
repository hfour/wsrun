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
  dependencies?: Dict<string>
  devDependencies?: Dict<string>
  scripts?: { [name: string]: string }
  private?: boolean
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
  // based on yarn v1.18.0 workspace resolution: https://github.com/yarnpkg/yarn/blob/v1.18.0/src/config.js#L794
  const registryFilenames = ['package.json', 'yarn.json']
  const registryFolders = ['node_modules']
  const trailingPattern = `/+(${registryFilenames.join('|')})`
  const ignorePatterns = registryFolders.map(
    folder => `/${folder}/**/+(${registryFilenames.join('|')})`
  )

  const pkgJsonPaths = flatMap(globs, (g: string) =>
    glob.sync(g.replace(/\/?$/, trailingPattern), {
      cwd: wsRoot,
      ignore: ignorePatterns.map(ignorePattern => g.replace(/\/?$/, ignorePattern))
    })
  )

  const packages: Packages = {}
  pkgJsonPaths.forEach(pkgJsonPath => {
    const pkgDir = path.dirname(pkgJsonPath)
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
    if (!pkgJson.name)
      throw new Error(`Package in directory ${pkgDir} has no name in ${path.basename(pkgJsonPath)}`)
    packages[pkgJson.name] = {
      path: path.join(wsRoot, pkgDir),
      json: pkgJson
    }
  })
  return packages
}
