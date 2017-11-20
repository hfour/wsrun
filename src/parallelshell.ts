/**
 * Remove me.
 */

import * as Promise from 'bluebird'
import { spawn, ChildProcess } from 'child_process'
var split = require('split')

let wait: boolean, verbose: boolean

wait = true
verbose = true

function prefixLine(pkgName: string, line: string, prefixLength = 15): string {
  const pkgNameShort = pkgName.slice(0, prefixLength - 1)
  const spaces = ' '.repeat(Math.max(1, prefixLength - pkgName.length))
  return `${pkgNameShort}${spaces} | ${line}`
}

export class CmdProcess {
  cmd: string
  cp: ChildProcess
  finished: Promise<CmdProcess>
  pkgName: string
  opts: {
    rejectOnNonZeroExit?: boolean
    collectLogs?: boolean
    addPrefix?: boolean
  }

  constructor(
    cmd: string,
    pkgName: string,
    opts: { rejectOnNonZeroExit?: boolean; collectLogs?: boolean; addPrefix?: boolean } = {}
  ) {
    this.pkgName = pkgName
    this.opts = opts
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

    const stdOutBuffer: string[] = []
    const stdErrBuffer: string[] = []

    this.cmd = cmd
    this.cp = spawn(sh, [shFlag, cmd], {
      cwd: (process.versions.node < '8.0.0' ? process.cwd : process.cwd()) as string,
      env: process.env,
      stdio: ['pipe']
    })

    if (this.opts.collectLogs) {
      this.cp.stdout.pipe(split()).on('data', (line: string) => {
        stdOutBuffer.push(line)
      })
      this.cp.stderr.pipe(split()).on('data', (line: string) => {
        stdErrBuffer.push(line)
      })
      this.cp.on('close', () => {
        console.log(
          stdOutBuffer
            .map(line => (this.opts.addPrefix ? prefixLine(this.pkgName, line) : line))
            .join('\n')
        )
        console.error(
          stdErrBuffer
            .map(line => (this.opts.addPrefix ? prefixLine(this.pkgName, line) : line))
            .join('\n')
        )
      })
    } else {
      this.cp.stdout.pipe(split()).on('data', (line: string) => {
        console.log(this.opts.addPrefix ? prefixLine(this.pkgName, line) : line)
      })
      this.cp.stderr.pipe(split()).on('data', (line: string) => {
        console.error(this.opts.addPrefix ? prefixLine(this.pkgName, line) : line)
      })
    }
  }
}

export class RunAll {
  children: CmdProcess[]
  finishedAll: Promise<CmdProcess[]>
  opts: { fastExit: boolean; collectLogs: boolean; addPrefix: boolean }

  constructor(
    pkgCmds: { pkgName: string; cmd: string }[],
    mode: 'parallel' | 'serial',
    opts: { fastExit: boolean; collectLogs: boolean; addPrefix: boolean }
  ) {
    this.children = []
    this.opts = opts

    if (mode === 'parallel') {
      this.finishedAll = Promise.map(pkgCmds, pkgCmd => {
        const child = new CmdProcess(pkgCmd.cmd, pkgCmd.pkgName, {
          rejectOnNonZeroExit: this.opts.fastExit,
          collectLogs: this.opts.collectLogs,
          addPrefix: this.opts.addPrefix
        })
        child.cp.on('close', code => code > 0 && this.closeAll.bind(this))
        this.children.push(child)
        return child.finished
      })
    } else {
      this.finishedAll = Promise.mapSeries(pkgCmds, pkgCmd => {
        const child = new CmdProcess(pkgCmd.cmd, pkgCmd.pkgName, {
          rejectOnNonZeroExit: this.opts.fastExit,
          collectLogs: this.opts.collectLogs,
          addPrefix: this.opts.addPrefix
        })
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
