import 'jest'
import { fixPaths } from './fix-paths'
import chalk from 'chalk';

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
})
