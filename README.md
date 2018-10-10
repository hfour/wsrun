# Workspace script runner

Run npm scripts in a yarn workspace.

### Usage:

```
wsrun cmd [<package>] [options]

Options:
  Mode (choose one):
    --parallel                      fully parallel mode (default)
    --stages                        run in stages; start with packages that have no deps.
    --serial                        same as "stages", but with no parallelism at the stage level

  Individual package opts:
    -r, --recursive                 execute the same script on all of its dependencies, too

  Misc:
    --fast-exit                     if at least one script exits with code > 0, abort
    --collect-logs                  collect per-package stdout, print everything at the end, grouped
    --no-prefix                     don't prefix output
    --bin=yarn                      which program should we pass the script to (default yarn)
    --done-criteria=regex           consider the process "done" when output line matches regex
    --exclude pkgname               skip actually running the script for that package
    --exclude-missing               skip packages which lack the specified script
    --report                        show an execution report once all scripts are finished
```

### Examples:

`yarn wsrun watch` will run `yarn watch` on every individual package, in parallel.

`yarn wsrun --stages build` will build all packages, in stages, starting from those that don't depend on other packages.

`yarn wsrun -p planc -r watch` will watch planc and all of its dependencies.

`yarn wsrun -p planc --exclude planc -r watch` will watch all of planc's dependencies but not planc

`yarn wsrun -p h4zip -r --stages build` will build all the deps. in order, then build h4zip

`yarn wsrun -p planc --stages --done-criteria='Compilation complete' -r watch` will watch planc deps, in order, continuing when command outputs "Compilation complete"

`yarn wsrun --exclude-missing test` will run the test script only on packages that have it

To specify multiple packages, use `-p` several times:

`yarn wsrun -p h4zip -p planc test` - run tests for both h4zip and planc

If you want to pass additional arguments to the command you can do that by separating the command
with `--`:

`yarn wsrun -r --stages -- build -p tsconfig.alternative.json` - build all packages in stages with
an alternative tsconfig.json

When `--skip-missing` is not used, you can pass a command that doesn't exist in the scripts field:

`yarn wsrun -r --stages -- tsc -p tsconfig.alternative.json` - run tsc for all packages with an alternative tsconfig
