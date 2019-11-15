import { Dict } from './workspace'
import * as path from 'path'

/**
 * filter the packages by checking if they have any changed files. This way is quicker
 * (mapping over packages) because package count is usually lower than changed files count
 * and we only need to check once per package.
 */
export const filterChangedPackages = (
  files: string[],
  pkgPaths: Dict<string>,
  workspacePath: string
) => {
  return Object.keys(pkgPaths).filter(pkg => {
    const pkgPath = pkgPaths[pkg]
    const p = path.join(workspacePath, pkgPath)

    return files.some(f => f.startsWith(p))
  })
}
