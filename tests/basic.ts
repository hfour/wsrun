import 'jest'
import { withScaffold, echo, wsrun } from './test.util'

let pkgList = (errorp3: boolean = false, condition?: string) => [
  echo.makePkg({ name: 'p1', dependencies: { p2: '*' } }, condition),
  echo.makePkg({ name: 'p2', dependencies: { p3: '*', p4: '*' } }, condition),
  errorp3
    ? echo.makePkgErr({ name: 'p3', dependencies: { p4: '*', p5: '*' } })
    : echo.makePkg({ name: 'p3', dependencies: { p4: '*', p5: '*' } }, condition),
  echo.makePkg({ name: 'p4', dependencies: { p5: '*' } }, condition),
  echo.makePkg({ name: 'p5', dependencies: {} }, condition)
]

describe('basic', () => {
  it('should run for all packages when in series', async () => {
    await withScaffold(
      {
        packages: pkgList()
      },
      async () => {
        let tst = await wsrun('--serial doecho')
        expect(tst.error).toBeFalsy()
        let output = await echo.getOutput()
        expect(output).toEqual(['p5', 'p4', 'p3', 'p2', 'p1', ''].join('\n'))
      }
    )
  })

  it('should run for all packages when parallel', async () => {
    await withScaffold(
      {
        packages: pkgList()
      },
      async () => {
        let wait = 0.25
        let tst = await wsrun(`--parallel doecho ${wait}`)
        expect(tst.error).toBeFalsy()
        let output = await echo.getOutput()
        expect(
          output
            .split('\n')
            .sort()
            .reverse()
        ).toEqual([`p5 ${wait}`, `p4 ${wait}`, `p3 ${wait}`, `p2 ${wait}`, `p1 ${wait}`, ''])
      }
    )
  })

  it('should run for a subset of packages in stages', async () => {
    await withScaffold(
      {
        packages: pkgList()
      },
      async () => {
        let tst = await wsrun('-p p3 --stages -r doecho')
        expect(tst.error).toBeFalsy()
        let output = await echo.getOutput()
        expect(output).toEqual(['p5', 'p4', 'p3', ''].join('\n'))
      }
    )
  })

  it('should pass arguments to echo', async () => {
    await withScaffold(
      {
        packages: pkgList()
      },
      async () => {
        let tst = await wsrun('-p p3 --stages -r doecho 0 hello world')
        expect(tst.error).toBeFalsy()
        let output = await echo.getOutput()
        expect(output).toEqual(
          ['p5 0 hello world', 'p4 0 hello world', 'p3 0 hello world', ''].join('\n')
        )
      }
    )
  })

  it('should support conditional execution', async () => {
    await withScaffold(
      {
        packages: pkgList(false, 'pwd | grep -q p4$')
      },
      async () => {
        let tst = await wsrun('--stages -r --if=condition -- doecho')
        expect(tst.error).toBeFalsy()
        let output = await echo.getOutput()
        expect(output).toEqual(['p4', ''].join('\n'))
      }
    )
  })

  it('should support dependant conditional execution', async () => {
    await withScaffold(
      {
        packages: pkgList(false, 'pwd | grep -q p2$')
      },
      async () => {
        let tst = await wsrun('--stages -r --if=condition --ifDependency -- doecho')
        expect(tst.error).toBeFalsy()
        let output = await echo.getOutput()
        expect(output).toEqual(['p2', 'p1', ''].join('\n'))
      }
    )
  })

  it('should fast-exit for a subset of packages in stages', async () => {
    await withScaffold(
      {
        packages: pkgList(true)
      },
      async () => {
        let tst = await wsrun('--stages -r --fast-exit doecho')
        expect(tst.stderr.toString()).toContain('Aborted execution due to previous error')
        let output = String(await echo.getOutput())
        expect(output).toEqual(['p5', 'p4', ''].join('\n'))
      }
    )
  })

  it('should not fast-exit without fast-exit when parallel', async () => {
    await withScaffold(
      {
        packages: pkgList(true)
      },
      async () => {
        let tst = await wsrun('doecho')
        expect(tst.status).toBeTruthy()
        let output = String(await echo.getOutput())
          .split('\n')
          .sort()
          .reverse()
        expect(output).toEqual(['p5', 'p4', 'p2', 'p1', ''])
      }
    )
  })

  it('should limit parallelism with --concurrency', async () => {
    await withScaffold(
      {
        packages: pkgList(false)
      },
      async () => {
        let tst = await wsrun('--parallel --concurrency 1 doecho')
        expect(tst.status).toBeFalsy()
        let output = String(await echo.getOutput())
        // will run in order due to concurrency limit
        expect(output).toEqual('p5\np4\np3\np2\np1\n')
      }
    )
  })

  it('should support globs', async () => {
    await withScaffold(
      {
        packages: [
          echo.makePkg({ name: 'app-x-frontend', dependencies: {} }),
          echo.makePkg({ name: 'app-x-backend', dependencies: {} }),
          echo.makePkg({ name: 'app-y-frontend', dependencies: { 'app-x-frontend': '*' } })
        ]
      },
      async () => {
        let tst = await wsrun('-p app-*-frontend --serial doecho')
        expect(tst.status).toBeFalsy()
        let output = String(await echo.getOutput())
        expect(output).toEqual('app-x-frontend\napp-y-frontend\n')
      }
    )
  })

  it('should not break with namespaced pkgs', async () => {
    await withScaffold(
      {
        packages: [
          echo.makePkg({ name: '@x/p1', path: 'packages/p1', dependencies: {} }),
          echo.makePkg({ name: '@x/p2', path: 'packages/p2', dependencies: { '@x/p1': '*' } })
        ]
      },
      async () => {
        let tst = await wsrun('--serial doecho')
        expect(tst.status).toBeFalsy()
        let output = String(await echo.getOutput())
        expect(output).toEqual('@x/p1\n@x/p2\n')
      }
    )
  })
})
