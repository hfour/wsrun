import { ChildProcess, spawn } from 'child_process'
import * as Bromise from 'bluebird'

import originalSplit = require('split')

import { Result, ResultSpecialValues } from './enums'
import { defer } from './utils'

import { IConsole } from './console'

export interface CmdOptions {
  silent?: boolean
  stdio: 'inherit' | 'pipe'
  pathRewriter?: (currentPath: string, line: string) => string
  doneCriteria?: string
  path: string
}

const SPLIT_OPTIONS = { trailing: false }
const SPLIT_MAPPER = (x: string) => x

const split = () => originalSplit(/\r?\n/, SPLIT_MAPPER, SPLIT_OPTIONS as any)

export class CmdProcess {
  private cp!: ChildProcess
  private _finished = defer<void>()
  private _exitCode = defer<number>()
  private _cancelled = defer<Result>()

  private doneCriteria?: RegExp

  /**
   * Finished will return true even if the process hasn't exited, if doneCriteria was found in
   * the output. Useful for watch processes that have initialization.
   *
   * It will also get rejected if there is a non-favorable exit code.
   */
  get finished() {
    return this._finished.promise
  }

  /**
   * Exitcode is always resolved with the exit code, never rejected.
   */
  get exitCode() {
    return this._exitCode.promise
  }

  get result() {
    return Bromise.race([this._exitCode.promise, this._cancelled.promise])
  }

  get cmdString() {
    return this.cmd.join(' ')
  }

  constructor(public console: IConsole, private cmd: string[], private opts: CmdOptions) {
    this.opts = opts

    if (this.opts.doneCriteria) this.doneCriteria = new RegExp(this.opts.doneCriteria)
  }

  start() {
    this._start(this.cmd)

    this.cp.once('exit', (code, signal) => {
      if (code > 0 || signal) {
        const msg =
          '`' + this.cmdString + '` failed with ' + (signal ? signal : 'exit code ' + code)
        if (!this.opts.silent) this.console.error(this.autoAugmentLine(msg))
      }
      this._finished.resolve()
      this._exitCode.resolve(code)
    })

    // ignore if unhandled
    this._finished.promise.catch(() => {})
  }

  stop() {
    if (this.cp) {
      this.cp.kill('SIGINT')
    }
    this._cancelled.resolve(ResultSpecialValues.Cancelled)
  }

  private autoPathRewrite(line: string) {
    return this.opts.pathRewriter ? this.opts.pathRewriter(this.opts.path, line) : line
  }

  private autoAugmentLine(line: string) {
    line = this.autoPathRewrite(line)
    return line
  }

  private _start(cmd: string[]) {
    let sh: string
    let args: string[]

    // cross platform compatibility
    if (process.platform === 'win32') {
      sh = 'cmd'
      args = ['/c'].concat(cmd)
    } else {
      ;[sh, ...args] = cmd
      //sh = 'bash'
      //shFlag = '-c'
    }

    this.cmd = cmd
    this.cp = spawn(sh, args, {
      cwd:
        this.opts.path ||
        ((process.versions.node < '8.0.0' ? process.cwd : process.cwd()) as string),
      env: Object.assign(process.env, process.stdout.isTTY ? { FORCE_COLOR: '1' } : {}),
      stdio: this.opts.stdio
    })

    if (this.cp.stdout)
      this.cp.stdout.pipe(split()).on('data', (line: string) => {
        this.console.log(this.autoAugmentLine(line))
        if (this.doneCriteria && this.doneCriteria.test(line)) this._finished.resolve()
      })
    if (this.cp.stderr)
      this.cp.stderr.pipe(split()).on('data', (line: string) => {
        this.console.error(this.autoAugmentLine(line))
        if (this.doneCriteria && this.doneCriteria.test(line)) this._finished.resolve()
      })
  }
}
