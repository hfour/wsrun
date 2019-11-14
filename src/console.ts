import { defer } from './utils'

export interface IConsole {
  log(msg: string): void
  error(msg: string): void
}

export interface ConsoleFactory {
  create(): IConsole
  active(c: IConsole): boolean
  discard(c: IConsole): void
  done(c: IConsole): void
}

class SerializedConsoleImpl implements IConsole {
  private _activeOutput = false
  private _outputBuffer: { type: 'stderr' | 'stdout'; line: string }[] = []
  public finished = defer<void>()

  constructor(private _console: Console) {}

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

  constructor(private _console: Console) {}

  private _start(c: SerializedConsoleImpl) {
    this._active = c
    this._active.activeOutput()

    this._active.finished.promise.then(() => {
      this._active = undefined

      let next = this._list.shift()
      if (next) {
        this._start(next)
      }
    })
  }

  create() {
    let c = new SerializedConsoleImpl(this._console)
    if (!this._active) {
      this._start(c)
    } else {
      this._list.push(c)
    }
    return c
  }

  active(c: IConsole) {
    return c === this._active
  }

  discard(c: IConsole) {
    this._list = this._list.filter(_c => c !== _c)
  }

  done(c: IConsole) {
    ;(c as SerializedConsoleImpl).finished.resolve()
  }
}

export class DefaultConsole implements ConsoleFactory {
  create() {
    return console
  }

  active(c: IConsole) {
    return true
  }

  discard(c: IConsole) {}
  done(c: IConsole) {}
}
