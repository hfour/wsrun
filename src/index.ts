#!/usr/bin/env node

/**
 * Tool for running command in yarn workspaces.
 */

import * as Promise from 'bluebird'
import * as fs from 'fs'
import { argv } from 'yargs'
import * as _ from 'lodash'

import { RunGraph } from './parallelshell'
import { listPkgs } from './workspace'

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

const cmd = argv._[0]
const pkgName = argv._[1]

if (!cmd) {
  throw new Error('cmd is undefined')
}

type BuildInstr = { name: string; order: number; cycle: boolean }

const workspaceGlobs = JSON.parse(fs.readFileSync('./package.json', 'utf8')).workspace || [
  'packages/*'
]

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
    workspacePath: process.cwd()
  },
  pkgPaths
)

let runlist = argv._.slice(1)
runner.run(cmd, runlist.length > 0 ? runlist : undefined).catch(err => {
  console.error('Aborting execution due to previous error')
  process.exit(1)
})
