import * as path from 'path'

export function fixPaths(workspacePath: string, packagePath: string, logLine: string) {
  return logLine.replace(/(([^/\s'"*]+[/]){1,})([^/'"*]+)\.[0-9a-zA-Z]{1,6}/, m =>
    path.relative(workspacePath, path.resolve(packagePath, m))
  )
}
