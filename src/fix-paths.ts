import * as path from 'path'

export function fixPaths(workspacePath: string, packagePath: string, logLine: string) {
  return logLine.replace(
    /([^/_0-9a-zA-Z])([-_0-9a-zA-Z.]([^\s/'"*]*[/]){1,})([^/'"*]+)\.[0-9a-zA-Z]{1,6}/,
    m => {
      return m[0] + path.relative(workspacePath, path.resolve(packagePath, m.substr(1)))
    }
  )
}
