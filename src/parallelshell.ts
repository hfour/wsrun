/**
 * Remove me.
 */

import * as Promise from 'bluebird'
import { spawn, ChildProcess } from 'child_process'
import originalSplit = require('split')
import { reject } from 'bluebird'
import * as tty from 'tty'
import chalk from 'chalk'
import * as path from 'path'

type PromiseFn<T> = () => Promise<T>
type PromiseFnRunner = <T>(f: PromiseFn<T>) => Promise<T>

let mkThroat = require('throat')(Promise) as ((limit: number) => PromiseFnRunner)

let passThrough: PromiseFnRunner = f => f()

let MaxPrefixLen = 15

class Prefixer {
  constructor(private wspath: string) {}
  private currentName = ''
  prefixer = (basePath: string, pkg: string, line: string) => {
    let l = ''
    if (this.currentName != pkg) l += chalk.bold((this.currentName = pkg)) + '\n'
    l += ' | ' + this.processFilePaths(basePath, line)
    return l
  }

  processFilePaths(basePath: string, line: string) {
    return line.replace(/(([^/\s'"*]+[/]){1,})([^/'"*]+)\.[0-9a-zA-Z]{1,6}/, m =>
      path.relative(this.wspath, path.resolve(basePath, m))
    )
  }
}

export interface CmdOptions {
  rejectOnNonZeroExit: boolean
  collectLogs: boolean
  prefixer?: (basePath: string, pkg: string, line: string) => string
  doneCriteria?: string
  path: string
}

interface Defer<T> {
  promise: Promise<T>
  resolve: (thenableOrResult?: T | PromiseLike<T> | undefined) => void
  reject: (error?: any) => void
}
function defer<T>() {
  let d: Defer<T>
  let promise = new Promise<T>((resolve, reject) => {
    d = { resolve, reject } as any
  })
  d!.promise = promise
  return d!
}

const SPLIT_OPTIONS = { trailing: false }
const SPLIT_MAPPER = (x: string) => x
const split = () => originalSplit(/\r?\n/, SPLIT_MAPPER, SPLIT_OPTIONS as any)

export class CmdProcess {
  cp: ChildProcess
  private _closed: Defer<number>
  private _finished: Defer<void>
  private _exitCode: Defer<number>

  get finished() {
    return this._finished.promise
  }
  get closed() {
    return this._closed.promise
  }
  get exitCode() {
    return this._exitCode.promise
  }

  doneCriteria?: RegExp

  constructor(private cmd: string, private pkgName: string, private opts: CmdOptions) {
    this.pkgName = pkgName
    this.opts = opts

    this._finished = defer<void>()
    this._exitCode = defer<number>()
    this._closed = defer<number>()

    if (this.opts.doneCriteria) this.doneCriteria = new RegExp(this.opts.doneCriteria)
  }

  start() {
    this._start(this.cmd)
    this.cp.once('close', code => {
      this._closed.resolve(code)
      this._exitCode.resolve(code)
    })

    this.cp.once('exit', code => this._exitCode.resolve(code))

    this.exitCode.then(code => {
      if (code > 0) {
        const msg = '`' + this.cmd + '` failed with exit code ' + code
        console.error(msg)
        if (this.opts.rejectOnNonZeroExit) return this._finished.reject(new Error(msg))
      }
      this._finished.resolve()
    })
  }

  private autoPrefix(line: string) {
    return this.opts.prefixer ? this.opts.prefixer(this.opts.path, this.pkgName, line) : line
  }

  private _start(cmd: string) {
    let sh: string
    let args: string[]

    // cross platform compatibility
    if (process.platform === 'win32') {
      sh = 'cmd'
      args = ['/c', cmd]
    } else {
      ;[sh, ...args] = cmd.split(' ')
      //sh = 'bash'
      //shFlag = '-c'
    }

    const stdOutBuffer: string[] = []
    const stdErrBuffer: string[] = []

    this.cmd = cmd
    this.cp = spawn(sh, args, {
      cwd:
        this.opts.path ||
        ((process.versions.node < '8.0.0' ? process.cwd : process.cwd()) as string),
      env: Object.assign(process.env, { FORCE_COLOR: process.stdout.isTTY }),
      stdio:
        this.opts.collectLogs || this.opts.prefixer != null || this.opts.doneCriteria
          ? 'pipe'
          : 'inherit'
    })

    if (this.cp.stdout)
      this.cp.stdout.pipe(split()).on('data', (line: string) => {
        if (this.opts.collectLogs) stdOutBuffer.push(line)
        else console.log(this.autoPrefix(line))
        if (this.doneCriteria && this.doneCriteria.test(line)) this._finished.resolve()
      })
    if (this.cp.stderr)
      this.cp.stderr.pipe(split()).on('data', (line: string) => {
        if (this.opts.collectLogs) stdErrBuffer.push(line)
        else console.error(this.autoPrefix(line))
        if (this.doneCriteria && this.doneCriteria.test(line)) this._finished.resolve()
      })
    if (this.opts.collectLogs)
      this.closed.then(() => {
        console.log(stdOutBuffer.map(line => this.autoPrefix(line)).join('\n'))
        console.error(stdErrBuffer.map(line => this.autoPrefix(line)).join('\n'))
      })
  }
}

import { PkgJson, Dict } from './workspace'
import { uniq } from 'lodash'
import { inherits } from 'util'

export interface GraphOptions {
  bin: string
  fastExit: boolean
  collectLogs: boolean
  addPrefix: boolean
  mode: 'parallel' | 'serial' | 'stages'
  recursive: boolean
  doneCriteria: string | undefined
  workspacePath: string
  exclude: string[]
  excludeMissing: boolean
}

export class RunGraph {
  private procmap = new Map<string, Promise<any>>()
  children: CmdProcess[]
  finishedAll: Promise<CmdProcess[]>
  private jsonMap = new Map<string, PkgJson>()
  private runList = new Set<string>()
  private throat: PromiseFnRunner = passThrough
  prefixer = new Prefixer(this.opts.workspacePath).prefixer

  constructor(
    public pkgJsons: PkgJson[],
    public opts: GraphOptions,
    public pkgPaths: Dict<string>
  ) {
    pkgJsons.forEach(j => this.jsonMap.set(j.name, j))
    this.children = []
    if (this.opts.mode === 'serial') this.throat = mkThroat(1)
    if (this.opts.mode === 'stages') this.throat = mkThroat(16) // max 16 proc

    process.on('SIGINT', this.closeAll) // close all children on ctrl+c
  }

  private closeAll = () => {
    console.log('Stopping', this.children.length, 'active children')
    this.children.forEach(ch => {
      ch.cp.removeAllListeners('close')
      ch.cp.removeAllListeners('exit')
      ch.cp.kill('SIGINT')
    })
  }

  private lookupOrRun(cmd: string, pkg: string): Promise<void> {
    let proc = this.procmap.get(pkg)
    if (proc == null) {
      proc = Promise.resolve().then(() => this.runOne(cmd, pkg))
      this.procmap.set(pkg, proc)
    }
    return proc
  }

  private allDeps(pkg: PkgJson) {
    let findMyDeps = uniq(
      Object.keys(pkg.dependencies || {}).concat(Object.keys(pkg.devDependencies || {}))
    ).filter(d => this.jsonMap.has(d) && (this.opts.recursive || this.runList.has(d)))
    return findMyDeps
  }

  detectCycles() {
    let topLevelPkgs: { [name: string]: any } = {}
    for (let key of this.jsonMap.keys()) {
      topLevelPkgs[key] = '*'
    }
    let top = { name: '$', dependencies: topLevelPkgs }
    let self = this
    function deepCycle(json: PkgJson, pathLookup: string[]): string[] {
      let newPathLookup = pathLookup.concat([json.name])
      let index = pathLookup.indexOf(json.name)
      if (index >= 0) {
        return newPathLookup.slice(index)
      }
      let currentDeps = Object.keys(json.dependencies || {}).concat(
        Object.keys(json.devDependencies || {})
      )
      for (let name of currentDeps) {
        let d = self.jsonMap.get(name)
        if (!d) continue
        let res = deepCycle(d, newPathLookup)
        if (res.length) return res
      }
      return []
    }
    let res = deepCycle(top, [])
    return res
  }

  private makeCmd(cmd: string, pkg: string) {
    return `${this.opts.bin} ${cmd}`
  }

  private runOne(cmd: string, pkg: string): Promise<void> {
    let p = this.jsonMap.get(pkg)
    if (p == null) throw new Error('Unknown package: ' + pkg)
    let myDeps = Promise.all(this.allDeps(p).map(d => this.lookupOrRun(cmd, d)))

    return myDeps.then(() => {
      if (this.opts.exclude.indexOf(pkg) >= 0) {
        console.log(chalk.bold(pkg), 'in exclude list, skipping')
        return Promise.resolve()
      }
      if (this.opts.excludeMissing && (!p || !p.scripts || !p.scripts[cmd])) {
        console.log(chalk.bold(pkg), 'has no ', cmd, 'script, skipping missing')
        return Promise.resolve()
      }
      let cmdLine = this.makeCmd(cmd, pkg)
      const child = new CmdProcess(cmdLine, pkg, {
        rejectOnNonZeroExit: this.opts.fastExit,
        collectLogs: this.opts.collectLogs,
        prefixer: this.opts.addPrefix ? this.prefixer : undefined,
        doneCriteria: this.opts.doneCriteria,
        path: this.pkgPaths[pkg]
      })
      child.exitCode.then(code => code > 0 && this.closeAll.bind(this))
      this.children.push(child)

      let finished = this.throat(() => {
        child.start()
        return child.finished
      })
      return this.opts.mode != 'parallel' ? finished : Promise.resolve()
    })
  }

  run(cmd: string, pkgs: string[] = this.pkgJsons.map(p => p.name)) {
    this.runList = new Set(pkgs)
    return Promise.all(pkgs.map(pkg => this.lookupOrRun(cmd, pkg))).thenReturn(void 0)
  }
}
