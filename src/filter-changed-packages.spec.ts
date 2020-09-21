import { filterChangedPackages } from './filter-changed-packages'

describe('filterChangedPackages', () => {
  it('should filter only the right package', async () => {
    const res = filterChangedPackages(
      ['packages/my-package-2/e.ts', 'packages/not-a-part-of-the-workspace/e.ts'],
      {
        a: 'my-package',
        b: 'my-package-2'
      },
      'packages'
    )

    expect(res).toEqual(['b'])
  })

  it('should filter out all packages if no package match is found', async () => {
    const res = filterChangedPackages(['packages2/c/example.ts'], { a: 'a', b: 'b' }, 'packages2')

    expect(res).toEqual([])
  })
})
