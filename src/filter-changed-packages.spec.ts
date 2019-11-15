import { filterChangedPackages } from './filter-changed-packages'

describe('filterChangedPackages', () => {
  it('should filter only the right package', async () => {
    const res = filterChangedPackages(
      ['packages/a/e.ts', 'packages/c/e.ts'],
      { a: 'a', b: 'b' },
      'packages'
    )

    expect(res).toEqual(['a'])
  })

  it('should filter out all packages if no package match is found', async () => {
    const res = filterChangedPackages(['packages2/c/example.ts'], { a: 'a', b: 'b' }, 'packages2')

    expect(res).toEqual([])
  })
})
