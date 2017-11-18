/**
 * Remove me.
 */

import * as Promise from 'bluebird';
import { spawn, ChildProcess } from 'child_process';

let wait: boolean, verbose: boolean;

wait = true;
verbose = true;

export class CmdProcess {
  cmd: string;
  cp: ChildProcess;
  finished: Promise<CmdProcess>;

  constructor(cmd: string) {
    this._start(cmd);
    this.finished = new Promise((resolve, reject) => {
      this.cp.on('close', (code: number) => {
        if (code > 0) {
          reject(new Error('`' + this.cmd + '` failed with exit code ' + code));
        } else {
          resolve(this);
        }
      });
    });
  }

  private _start(cmd: string) {
    let sh: string;
    let shFlag: string;

    // cross platform compatibility
    if (process.platform === 'win32') {
      sh = 'cmd';
      shFlag = '/c';
    } else {
      sh = 'bash';
      shFlag = '-c';
    }

    this.cmd = cmd;
    this.cp = spawn(sh, [shFlag, cmd], {
      cwd: (process.versions.node < '8.0.0' ? process.cwd : process.cwd()) as string,
      env: process.env,
      stdio: ['pipe', process.stdout, process.stderr], // todo: don't pipe when collecting output
    });
  }
}

export class RunAll {
  children: CmdProcess[];
  finishedAll: Promise<CmdProcess[]>;
  fastExit: boolean;

  constructor(cmds: string[], mode: 'parallel' | 'serial') {
    this.children = [];
    this.fastExit = false; // todo: this is broken. true no work. we need to check if code > 1

    if (mode === 'parallel') {
      this.finishedAll = Promise.map(cmds, cmd => {
        const child = new CmdProcess(cmd);
        this.fastExit && child.cp.on('close', this.closeAll.bind(this));
        this.children.push(child);
        return child.finished;
      });
    } else {
      this.finishedAll = Promise.mapSeries(cmds, cmd => {
        const child = new CmdProcess(cmd);
        this.fastExit && child.cp.on('close', this.closeAll.bind(this));
        this.children = [child];
        return child.finished;
      });
    }

    process.on('SIGINT', this.closeAll.bind(this)); // close all children on ctrl+c
  }

  /**
   * kills all the children
   */
  closeAll() {
    this.children.forEach(ch => {
      ch.cp.removeAllListeners('close');
      ch.cp.kill('SIGINT');
    });
  }
}
