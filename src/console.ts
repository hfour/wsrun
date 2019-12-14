import * as Bromise from 'bluebird'
import { defer, Defer } from './utils'

export interface IConsole {
  log(msg: string): void
  error(msg: string): void
}

export interface ConsoleFactory {
  create(console: IConsole): IConsole
  discard(c: IConsole): void
  done(c: IConsole): void
  flush(): Bromise<void>
}

class SerializedConsoleImpl implements IConsole {
  private _activeOutput = false
  private _outputBuffer: { type: 'stderr' | 'stdout'; line: string }[] = []
  public finished = defer<void>()

  constructor(private _console: IConsole) {}

  activeOutput() {
    this._activeOutput = true

    this._outputBuffer.forEach(line => {
      if (line.type === 'stdout') this._console.log(line.line)
      else this._console.error(line.line)
    })
    this._outputBuffer = []
  }

  log(msg: string) {
    if (this._activeOutput) this._console.log(msg)
    else this._outputBuffer.push({ type: 'stdout', line: msg })
  }

  error(msg: string) {
    if (this._activeOutput) this._console.error(msg)
    else this._outputBuffer.push({ type: 'stderr', line: msg })
  }
}

export class SerializedConsole implements ConsoleFactory {
  private _active: SerializedConsoleImpl | undefined
  private _list: SerializedConsoleImpl[] = []
  private _done: Defer<void> | undefined

  private _start(c: SerializedConsoleImpl) {
    this._active = c
    this._active.activeOutput()

    this._active.finished.promise.then(() => {
      this._active = undefined

      let next = this._list.shift()
      if (next) {
        this._start(next)
      } else if (this._done) {
        this._done.resolve()
      }
    })
  }

  create(parent: IConsole) {
    let c = new SerializedConsoleImpl(parent)
    if (!this._active) {
      this._start(c)
    } else {
      this._list.push(c)
    }
    return c
  }

  discard(c: IConsole) {
    this._list = this._list.filter(_c => c !== _c)
  }

  done(c: IConsole) {
    ;(c as SerializedConsoleImpl).finished.resolve()
  }

  flush() {
    if (this._list.length === 0) {
      return Bromise.resolve()
    } else {
      this._done = defer()
      return this._done.promise
    }
  }
}

export class DefaultConsole implements ConsoleFactory {
  create(parent: IConsole) {
    return parent
  }

  active(c: IConsole) {
    return true
  }

  discard(c: IConsole) {}
  done(c: IConsole) {}

  flush() {
    return Bromise.resolve()
  }
}

export class PrefixedConsole implements IConsole {
  private static _last: PrefixedConsole | undefined

  constructor(private _console: IConsole, private _name: string, private _prefix: string) {}

  log(msg: string) {
    if (PrefixedConsole._last !== this) {
      this._console.log(this._name + '\n' + this._prefix + msg)
      PrefixedConsole._last = this
    } else {
      this._console.log(this._prefix + msg)
    }
  }

  error(msg: string) {
    if (PrefixedConsole._last !== this) {
      this._console.error(this._name + '\n' + this._prefix + msg)
      PrefixedConsole._last = this
    } else {
      this._console.error(this._prefix + msg)
    }
  }
}
