import { expandRevDeps } from './rev-deps'

describe('expandRevDeps', () => {
  it('should return empty array when no packages are supplied', async () => {
    const res = expandRevDeps([], [{ name: 'a' }, { name: 'b' }])

    expect(res).toEqual([])
  })

  it('should return the same packages if no matches are found', async () => {
    const res = expandRevDeps(['c'], [{ name: 'a' }, { name: 'b' }])

    expect(res).toEqual(['c'])
  })

  it('should return the original list plus the proper reverse dependencies', async () => {
    const res = expandRevDeps(
      ['c'],
      [
        {
          name: 'a',
          dependencies: {
            c: '*'
          }
        },
        {
          name: 'b',
          devDependencies: {
            c: '*'
          }
        },
        {
          name: 'd'
        }
      ]
    )

    expect(res).toEqual(['c', 'a', 'b'])
  })
})
