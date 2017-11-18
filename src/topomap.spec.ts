import 'jest';

import { buildOrder, pkgMap } from './topomap';

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
    dependencies: { },
  }
];

describe('topomap', () => {
  it('should have deepDeps', () => {
    let pm = pkgMap(pkgs);
    let p = pm.map.get('backend')!
    console.log(p.deepDependencies)
  });
});
