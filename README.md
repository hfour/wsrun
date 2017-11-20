# Workspace command runner

Usage:

```
wsrun cmd [<package>] [options]

Options:
  Mode (choose one):
    --parallel                      fully parallel mode (default)
    --stages                        run in stages; start with packages that have no deps.
    --serial                        same as "stages", but with no parallelism at the stage level

  Individual package opts:
    -r, --recursive                 execute the same cmd on all of its dependencies, too

  Misc:
    --fast-exit                     if at least one command exits with code > 0, abort
    --collect-output                (not impl) collect per-package stdout, print everything at the end, grouped
    --prefix-logs                   (not impl) prefix stdout lines with "package_name |"
    --pkgs-dir=<path>               (not impl) path to packages folder. default is "./packages"
    --bin=yarn                      which program should we pass the cmd to
```

Examples:

`yarn wsrun watch` will run `yarn watch` on every individual package, in parallel.

`yarn wsrun build --stages` will build all packages, in stages, starting from those that don't depend on other packages.

`yarn wsrun watch planc --r` will watch planc and all of its dependencies.

`yarn wsrun build h4zip --r --stages` will build all the deps. in order, then build h4zip

`yarn wsrun clean` will remove the build folders in every package.

`yarn wsrun test` will test every package.

Todo:

* Support for collecting stdouts
* Support for stdout line prefixes
* Reorganize files
* Parse TL workspaces glob, generate paths from it
