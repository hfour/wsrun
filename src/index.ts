#!/usr/bin/env node

/**
 * Tool for running command in yarn workspaces.
 */

import * as Promise from 'bluebird'
import * as fs from 'fs'
import * as yargs from 'yargs'
import * as _ from 'lodash'
import chalk from 'chalk'

import { RunGraph } from './parallelshell'
import { listPkgs } from './workspace'

yargs
  .wrap(yargs.terminalWidth() - 1)
  .usage('Usage: $0 <command> [<package>] [options]')
  .group(['parallel', 'stages', 'serial'], 'Mode (choose one):')
  .options({
    'parallel': {
      describe: 'Fully parallel mode (default)'
    },
    'stages': {
      describe: 'Run in stages: start with packages that have no deps'
    },
    'serial': {
      describe: 'Same as "stages" but with no parallelism at the stage level'
    }
  })
  .group('recursive', 'Individual Package Options:')
  .options({
    'recursive': {
      alias: 'r',
      describe: 'Execute the same script on all of its dependencies, too'
    }
  })
  .group([
    'fast-exit',
    'collect-logs',
    'no-prefix',
    'bin',
    'done-criteria',
    'exclude',
    'exclude-missing',
    'report'
  ], 'Misc Options:')
  .options({
    'fast-exit': {
      describe: 'If at least one script exits with code > 0, abort'
    },
    'collect-logs': {
      describe: 'Collect per-package output and print it at the end of each script'
    },
    'no-prefix': {
      describe: 'Don\'t prefix output'
    },
    'bin': {
      default: 'yarn',
      describe: 'The program to pass the command to'
    },
    'done-criteria': {
      describe: 'Consider a process "done" when an output line matches the specified RegExp'
    },
    'exclude': {
      type: 'string',
      describe: 'Skip running the command for that package'
    },
    'exclude-missing': {
      describe: 'Skip packages which lack the specified command in the scripts section of their package.json'
    },
    'report': {
      describe: 'Show an execution report once the command has finished in each package'
    }
  })
  .example('',
    `wsrun clean - Will run "yarn clean" in each of the packages in parallel
wsrun build --stages - Will run "yarn build" in each of the packages in stages, moving up the dependency tree
wsrun watch app -r --stages --done-criteria='Compilation complete' - Will run "yarn watch" in app and all of its dependencies in stages, continuing when the process outputs "Compilation Complete."
wsrun test --exclude-missing - Will run "yarn test" in all packages that have such a script`)

const argv = yargs.argv
const bin = argv.bin || 'yarn'

let mode: string
if (argv.stages) {
  mode = 'stages'
} else if (argv.serial) {
  mode = 'serial'
} else {
  mode = 'parallel'
}

// should we run the command on all the dependencies, too?
const recursive: boolean = argv.recursive || argv.r || false
const fastExit: boolean = argv.fastExit || false
const collectLogs: boolean = argv.collectLogs || false
const addPrefix: boolean = argv.prefix === undefined ? true : false
const doneCriteria: string = argv.doneCriteria
const exclude: string[] =
  (argv.exclude && (Array.isArray(argv.exclude) ? argv.exclude : [argv.exclude])) || []

const excludeMissing = argv.excludeMissing || false

const showReport: boolean = argv.report || false

const cmd = argv._[0]
const pkgName = argv._[1]

if (!cmd) {
  yargs.showHelp();
  process.exit(1);
}

type BuildInstr = { name: string; order: number; cycle: boolean }

const packageJsonWorkspaces = JSON.parse(fs.readFileSync('./package.json', 'utf8')).workspaces
const packageJsonWorkspacesNohoistFormat = packageJsonWorkspaces && packageJsonWorkspaces.packages

const workspaceGlobs = packageJsonWorkspacesNohoistFormat || packageJsonWorkspaces || ['packages/*']

const pkgs = listPkgs('./', workspaceGlobs)
const pkgPaths = _.mapValues(_.keyBy(pkgs, p => p.json.name), v => v.path)

const pkgJsons = _.map(pkgs, pkg => pkg.json)

let runner = new RunGraph(
  pkgJsons,
  {
    bin,
    fastExit,
    collectLogs,
    addPrefix,
    mode: mode as any,
    recursive,
    doneCriteria,
    exclude,
    excludeMissing,
    showReport,
    workspacePath: process.cwd()
  },
  pkgPaths
)

let cycle = runner.detectCycles()
if (cycle.length > 0) {
  console.error('\nERROR: Dependency cycle detected:\n', ' ', cycle.join(' <- '), '\n')
  process.exit(1)
}

let runlist = argv._.slice(1)
runner.run(cmd, runlist.length > 0 ? runlist : undefined).then(hadError => {
  if (hadError && fastExit) {
    console.error(chalk.red(`Aborted execution due to previous error`))
  }
  process.exit(hadError ? 1 : 0)
})
