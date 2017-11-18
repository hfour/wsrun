import 'jest'

import { buildOrder, subsetBuildOrder } from './topomap'

let pkgs = [
  {
    name: 'backend',
    version: '1.0.0',
    dependencies: {
      lodash: '3.10.1',
      'h4-zip': '^1.0.0',
      'h4-format': '^1.0.0'
    }
  },
  {
    name: 'h4-format',
    version: '1.0.0',
    dependencies: {
      lodash: '^4.17.4',
      'h4-zip': '^1.0.0'
    }
  },
  {
    name: 'h4-zip',
    version: '1.0.0',
    dependencies: {}
  }
]

describe('topomap', () => {
  it('should create full build order', () => {
    let fbo = buildOrder(pkgs)[0].sort((p1, p2) => p1.order - p2.order)

    expect(fbo).toMatchObject([
      { name: 'h4-zip', order: 1 },
      { name: 'h4-format', order: 2 },
      { name: 'backend', order: 3 }
    ])
  })
  it('should create subset build order', () => {
    let sbo = subsetBuildOrder(pkgs, ['backend']).sort((p1, p2) => p1.order - p2.order)

    expect(sbo).toMatchObject([{ name: 'h4-format', order: 1 }, { name: 'backend', order: 2 }])
  })
})
