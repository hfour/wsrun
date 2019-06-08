import * as path from 'path'

export function fixPaths(workspacePath: string, packagePath: string, logLine: string) {
  return logLine.replace(
    /([\u001b][^m]*m|[^/_@0-9a-zA-Z])(([-_0-9a-zA-Z.]([^\s/'"*:]*[/]){1,})([^/'"*]+)\.[0-9a-zA-Z]{1,6})/,
    (_m, before, file) => {
      return before + path.relative(workspacePath, path.resolve(packagePath, file))
    }
  )
}
