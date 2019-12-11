import { PkgJson } from './workspace'

/**
 * For given list of packages, expand that list with all dependents on them
 * @param pkgs original list of packages (to be filtered)
 * @param pkgJsons list of packages in the workspace
 */
export const expandRevDeps = (pkgs: string[], pkgJsons: PkgJson[]) => {
  let index: number = 0
  while (index < pkgs.length) {
    const pkg = pkgs[index]

    // find the packages which have the iteratee as dependency or devDependency
    const found = pkgJsons
      .filter(
        p =>
          (p.dependencies && p.dependencies[pkg]) || (p.devDependencies && p.devDependencies[pkg])
      )
      .map(p => p.name)
      .filter(p => pkgs.indexOf(p) === -1)

    pkgs = pkgs.concat(found)

    index++
  }

  return pkgs
}
