#!/usr/bin/env node

/**
 * Tool for running command in yarn workspaces.
 */

import * as fs from 'fs'
import * as yargs from 'yargs'
import * as _ from 'lodash'
import chalk from 'chalk'

import { RunGraph } from './run-graph'
import { listPkgs } from './workspace'

let yargsParser = yargs
  .wrap(yargs.terminalWidth() - 1)
  .updateStrings({
    'Options:': 'Other Options:'
  })
  .usage('$0 [options] <command> [<arg1> <arg2> ...] ')
  // Note: these examples are chained here as they do not show up otherwise
  // when the required positional <command> is not specified
  .example('$0 clean', 'Runs "yarn clean" in each of the packages in parallel')
  .example(
    '$0 -p app -r --stages build',
    'Runs "yarn build" in app and all of its dependencies in stages, moving up the dependency tree'
  )
  .example(
    '$0 --stages --done-criteria="Finished" watch',
    'Runs "yarn watch" in each of the packages in stages, continuing when the process outputs "Finished"'
  )
  .example('$0 --exclude-missing test', 'Runs "yarn test" in all packages that have such a script')

  .group(['parallel', 'stages', 'serial'], 'Mode (choose one):')
  .options({
    parallel: {
      boolean: true,
      describe: 'Fully parallel mode (default)'
    },
    stages: {
      boolean: true,
      describe: 'Run in stages: start with packages that have no deps'
    },
    serial: {
      boolean: true,
      describe: 'Same as "stages" but with no parallelism at the stage level'
    }
  })
  .group(['recursive', 'package'], 'Package Options:')
  .options({
    package: {
      alias: 'p',
      describe: 'Run only for this package. Can be used multiple times.',
      type: 'array'
    },
    c: {
      boolean: true,
      describe:
        'Denotes the end of the package list and the beginning of the command. Can be used instead of "--"'
    },
    recursive: {
      alias: 'r',
      boolean: true,
      describe: 'Execute the same script on all of its dependencies, too'
    }
  })
  .group(
    [
      'fast-exit',
      'collect-logs',
      'no-prefix',
      'bin',
      'done-criteria',
      'exclude',
      'exclude-missing',
      'report',
      'if',
      'ifDependency'
    ],
    'Misc Options:'
  )
  .options({
    if: {
      describe: 'Run main command only if this condition runs successfully'
    },
    ifDependency: {
      describe:
        'Run main command only if packages dependencies passed the condition (not available in parallel mode)',
      boolean: true
    },
    'fast-exit': {
      boolean: true,
      describe: 'If at least one script exits with code > 0, abort'
    },
    'collect-logs': {
      boolean: true,
      describe: 'Collect per-package output and print it at the end of each script'
    },
    'no-prefix': {
      boolean: true,
      describe: "Don't prefix output"
    },
    bin: {
      default: 'yarn',
      describe: 'The program to pass the command to',
      type: 'string'
    },
    'done-criteria': {
      describe: 'Consider a process "done" when an output line matches the specified RegExp'
    },
    exclude: {
      type: 'string',
      describe: 'Skip running the command for that package'
    },
    'exclude-missing': {
      boolean: true,
      describe:
        'Skip packages which lack the specified command in the scripts section of their package.json'
    },
    report: {
      boolean: true,
      describe: 'Show an execution report once the command has finished in each package'
    }
  })

function parsePositionally(yargs: yargs.Argv, cmd: string[]) {
  let newCmd = cmd.map((c, i) => (c.startsWith('-') ? c : c + ':' + i.toString()))
  let positional = yargs.parse(newCmd)
  if (!positional._.length) return yargs.parse(cmd)

  let position = Number(positional._[0].substr(positional._[0].lastIndexOf(':') + 1))

  let result = yargs.parse(cmd.slice(0, position))
  result._ = result._.concat(cmd.slice(position))
  return result
}

const argv = parsePositionally(yargsParser, process.argv.slice(2)) // yargs.argv
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

const cmd = argv._

if (!cmd.length) {
  yargs.showHelp()
  process.exit(1)
}

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
    if: argv.if || null,
    ifDependency: argv.ifDependency || false,
    workspacePath: process.cwd()
  },
  pkgPaths
)

let cycle = runner.detectCycles()
if (cycle.length > 0) {
  console.error('\nERROR: Dependency cycle detected:\n', ' ', cycle.join(' <- '), '\n')
  process.exit(1)
}

let runlist = argv.package || []

runner.run(cmd, runlist.length > 0 ? runlist : undefined).then(hadError => {
  if (hadError && fastExit) {
    console.error(chalk.red(`Aborted execution due to previous error`))
  }
  process.exit(hadError ? 1 : 0)
})
