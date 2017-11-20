#!/usr/bin/env node

/**
 * Tool for running command in yarn workspaces.
 */

import * as Promise from 'bluebird'
import * as fs from 'fs'
import { argv } from 'yargs'
import * as _ from 'lodash'

import { RunAll } from './parallelshell'
import { listPkgs } from './workspace'
import { buildOrder, subsetBuildOrder } from './topomap'

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
let recursive = !!argv.recursive || !!argv.r
let fastExit = !!argv.fastExit

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

function genCmd(bi: BuildInstr) {
  return `cd ${pkgPaths[bi.name]} && ${bin} ${cmd}`
}

// choose which packages to run the command on
let sortedInstrs: BuildInstr[]
if (pkgName) {
  if (recursive) {
    sortedInstrs = subsetBuildOrder(pkgJsons, [pkgName])
  } else {
    sortedInstrs = [{ name: pkgName, order: 1, cycle: false }]
  }
} else {
  sortedInstrs = buildOrder(pkgJsons)
}
sortedInstrs = _.sortBy(sortedInstrs, 'order')

let runner: Promise<any>

if (mode === 'stages' || mode === 'serial') {
  const runMode = mode === 'stages' ? 'parallel' : 'serial'
  // generate stages
  const stages = []
  let i = 1
  while (true) {
    const stage = sortedInstrs.filter(pkg => pkg.order === i)
    if (!stage.length) break
    stages.push(stage)
    i++
  }

  // run in batches
  runner = Promise.mapSeries(stages, stg => {
    console.log('----- RUNNING A STAGE -----')
    console.log('Packages in stage:', stg.map(p => p.name).join(', '))
    const cmds = stg.map(genCmd)
    return new RunAll(cmds, runMode, { fastExit }).finishedAll
  })
} else {
  const cmds = sortedInstrs.map(genCmd)
  runner = new RunAll(cmds, 'parallel', { fastExit }).finishedAll
}
