# Workspace command runner

Usage:

```
wsrun cmd [<package>] [options]

Options:
  Mode (choose one):
    --parallel                      fully parallel mode (default)
    --smart                         in stages; start with packages that have no deps.
    --serial                        same as smart, but with no parallelism at the stage level

  Individual package opts:
    --all                           execute the same cmd on all of its dependencies, too

  Misc:
    --fast-exit                     if at least one command exits with code > 0, abort
    --collect-output                collect per-package stdout, print everything at the end, grouped
    --prefix-logs                   prefix stdout lines with "package_name |"
    --pkgs-dir=<path>               path to packages folder. default is "./packages"
    --bin=yarn                      which program should we pass the cmd to
```

Examples:

`yarn wsrun watch` will run `yarn watch` on every individual package, in parallel.

`yarn wsrun build --smart` will build all packages, in stages, starting from those that don't depend on other packages.

`yarn wsrun watch planc --all` will watch planc and all of its dependencies.

`yarn wsrun build h4zip --all --smart` will build all the deps. in order, then build h4zip

`yarn wsrun clean` will remove the build folders in every package.

`yarn wsrun test` will test every package.

Todo:

* Move to a separate repo
* Add support for single pkg commands
* Support for collecting stdouts
* Support for stdout line prefixes
* Reorganize files
* Parse TL workspaces glob, generate paths from it
