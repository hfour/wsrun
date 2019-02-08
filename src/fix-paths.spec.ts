import { fixPaths } from './fix-paths'

describe('fix paths', () => {
  it('works', () => {
    let res = fixPaths('/a/b/c', '/a/b/c/packages/p', 'Testing (src/test.ts:12)')
    console.log(res)
  })
})
