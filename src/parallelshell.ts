/**
 * Remove me.
 */

import * as Promise from 'bluebird'
import { spawn, ChildProcess } from 'child_process'

let wait: boolean, verbose: boolean

wait = true
verbose = true

export class CmdProcess {
  cmd: string
  cp: ChildProcess
  finished: Promise<CmdProcess>
  opts: {
    rejectOnNonZeroExit?: boolean
  }

  constructor(cmd: string, opts: { rejectOnNonZeroExit?: boolean } = {}) {
    this.opts = opts
    console.log('Executing cmd:', cmd)
    this._start(cmd)
    this.finished = new Promise((resolve, reject) => {
      this.cp.on('close', (code: number) => {
        if (code > 0) {
          const msg = '`' + this.cmd + '` failed with exit code ' + code
          console.error(msg)
          if (this.opts.rejectOnNonZeroExit) {
            reject(new Error(msg))
          } else {
            resolve(this)
          }
        } else {
          resolve(this)
        }
      })
    })
  }

  private _start(cmd: string) {
    let sh: string
    let shFlag: string

    // cross platform compatibility
    if (process.platform === 'win32') {
      sh = 'cmd'
      shFlag = '/c'
    } else {
      sh = 'bash'
      shFlag = '-c'
    }

    this.cmd = cmd
    this.cp = spawn(sh, [shFlag, cmd], {
      cwd: (process.versions.node < '8.0.0' ? process.cwd : process.cwd()) as string,
      env: process.env,
      stdio: ['pipe', process.stdout, process.stderr] // todo: don't pipe when collecting output
    })
  }
}

export class RunAll {
  children: CmdProcess[]
  finishedAll: Promise<CmdProcess[]>
  opts: { fastExit?: boolean }

  constructor(cmds: string[], mode: 'parallel' | 'serial', opts: { fastExit: boolean }) {
    this.children = []
    this.opts = opts

    if (mode === 'parallel') {
      this.finishedAll = Promise.map(cmds, cmd => {
        const child = new CmdProcess(cmd, { rejectOnNonZeroExit: this.opts.fastExit })
        child.cp.on('close', code => code > 0 && this.closeAll.bind(this))
        this.children.push(child)
        return child.finished
      })
    } else {
      this.finishedAll = Promise.mapSeries(cmds, cmd => {
        const child = new CmdProcess(cmd, { rejectOnNonZeroExit: this.opts.fastExit })
        child.cp.on('close', code => code > 0 && this.closeAll.bind(this))
        this.children = [child]
        return child.finished
      })
    }

    process.on('SIGINT', this.closeAll.bind(this)) // close all children on ctrl+c
  }

  /**
   * kills all the children
   */
  closeAll() {
    this.children.forEach(ch => {
      ch.cp.removeAllListeners('close')
      ch.cp.kill('SIGINT')
    })
  }
}
