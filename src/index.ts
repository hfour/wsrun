#!/usr/bin/env node

/**
 * Tool for running command in yarn workspaces.
 */

import * as Promise from 'bluebird';
import { argv } from 'yargs';
import * as _ from 'lodash';

import { RunAll } from './parallelshell';
import { listPkgs } from './workspace';
import { buildOrder } from './topomap';

/*tslint:disable*/

const bin = argv.bin || 'yarn';

let mode: string;
if (argv.smart) {
  mode = 'smart';
} else if (argv.serial) {
  mode = 'serial';
} else {
  mode = 'parallel';
}

const cmd = argv._[0];
// const pkgName = argv._[1];

if (!cmd) {
  throw new Error('cmd is undefined');
}

type BuildInstr = { name: string; order: number; cycle: boolean };

function genCmd(bi: BuildInstr) {
  return `cd ./packages/${bi.name} && ${bin} ${cmd}`;
}

const pkgJsons = _.map(listPkgs('./packages'), pkg => pkg.json);
const sortedInstrs = _.sortBy(buildOrder(pkgJsons)[0], 'order');

if (mode === 'smart' || mode === 'serial') {
  const runMode = mode === 'smart' ? 'parallel' : 'serial';
  // generate stages
  const stages = [];
  let i = 1;
  while (true) {
    const stage = sortedInstrs.filter(pkg => pkg.order === i);
    if (!stage.length) break;
    stages.push(stage);
    i++;
  }
  // run in batches
  Promise.mapSeries(stages, stg => {
    console.log('----- RUNNING A STAGE -----');
    const cmds = stg.map(genCmd);
    return new RunAll(cmds, runMode).finishedAll;
  });
} else {
  const cmds = sortedInstrs.map(genCmd);
  new RunAll(cmds, 'parallel');
}
