import 'jest'
import { fixPaths } from './fix-paths'
import chalk from 'chalk'

describe('fix paths', () => {
  it('works', () => {
    let res = fixPaths('/a/b/c', '/a/b/c/packages/p', 'Testing (src/test.ts:12)')
    expect(res).toEqual('Testing (packages/p/src/test.ts:12)')
  })

  it('works without brackets', () => {
    let res = fixPaths('/a/b/c', '/a/b/c/packages/p', 'Testing src/test.ts:12')
    expect(res).toEqual('Testing packages/p/src/test.ts:12')
  })
  it('does not do absolute paths', () => {
    let res = fixPaths('/a/b/c', '/a/b/c/packages/p', 'Testing /src/test.ts:12')
    expect(res).toEqual('Testing /src/test.ts:12')
  })

  it('ignores absolute paths that contain @', () => {
    let logLine = 'at (/Thing/src/node_modules/@h4bff/backend/src/rpc/serviceRegistry.ts:54:54)'
    let res = fixPaths('/Thing/src/', '/Thing/src/packages/app-lib-ca-backend', logLine)
    expect(res).toEqual(logLine)
  })

  it('does not do absolute paths without brackets', () => {
    let res = fixPaths('/a/b/c', '/a/b/c/packages/p', 'Testing /src/test.ts:12')
    expect(res).toEqual('Testing /src/test.ts:12')
  })

  it('applies relative paths', () => {
    let res = fixPaths('/a/b/c', '/a/b/c/packages/p', 'Testing ../src/test.ts:12')
    expect(res).toEqual('Testing packages/src/test.ts:12')
  })

  it('works with color codes', () => {
    let res = fixPaths('/a/b/c', '/a/b/c/packages/p', 'Testing ' + chalk.blue('src/test.ts:12'))
    expect(res).toEqual('Testing ' + chalk.blue('packages/p/src/test.ts:12'))
  })

  it('doesnt rewrite URLs', () => {
    let res = fixPaths('/a/b/c', '/a/b/c/packages/p', 'Testing http://src/test.ts')
    expect(res).toEqual('Testing http://src/test.ts')
  })

  it('works with dashes', () => {
    let res = fixPaths(
      '/a/b/c',
      '/a/b/c/packages/p',
      'Testing (/a/b/c/packages/test-package/src/file.ts:12'
    )
    expect(res).toEqual('Testing (/a/b/c/packages/test-package/src/file.ts:12')
  })
})
