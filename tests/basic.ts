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

  it.only('should pass arguments to echo', async () => {
    await withScaffold(
      {
        packages: pkgList()
      },
      async () => {
        let tst = await wsrun('-p p3 --stages -r doecho -p hello world')
        expect(tst.error).toBeFalsy()
        let output = await echo.getOutput()
        expect(output).toEqual(
          ['p5 -p hello world', 'p4 -p hello world', 'p3 -p hello world', ''].join('\n')
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
})
