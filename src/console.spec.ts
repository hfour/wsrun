import { SerializedConsole } from './console'
import { mock, instance, verify } from 'ts-mockito'

function nextTick() {
  return new Promise(resolve => setImmediate(resolve))
}

describe('serialized console', () => {
  let console: Console

  let c: SerializedConsole

  beforeEach(() => {
    console = mock()
    c = new SerializedConsole(instance(console))
  })

  it('should only output from the active console', () => {
    let c1 = c.create()
    let c2 = c.create()

    c1.log('hello 1')
    verify(console.log('hello 1')).once()
    c2.log('hello 2')
    verify(console.log('hello 2')).never()
    c1.log('hello 3')
    verify(console.log('hello 3')).once()
    c2.log('hello 4')
    verify(console.log('hello 4')).never()
  })

  it('should output the second console when the first is done', async () => {
    let c1 = c.create()
    let c2 = c.create()

    c1.log('hello 1')
    verify(console.log('hello 1')).once()
    c2.log('hello 2')
    verify(console.log('hello 2')).never()

    c.done(c1)
    await nextTick()

    verify(console.log('hello 2')).once()

    c2.log('hello 3')
    verify(console.log('hello 3')).once()
  })

  it('should output from all consoles when they are done in the wrong order', async () => {
    let c1 = c.create()
    let c2 = c.create()
    let c3 = c.create()

    c1.log('hello 1')
    verify(console.log('hello 1')).once()
    c2.log('hello 2')
    verify(console.log('hello 2')).never()
    c3.log('hello 3')
    verify(console.log('hello 3')).never()

    c.done(c2)
    await nextTick()

    verify(console.log('hello 2')).never()
    verify(console.log('hello 3')).never()

    c.done(c1)
    await nextTick()

    verify(console.log('hello 2')).once()
    verify(console.log('hello 3')).once()
  })

  it('should log from console created after the first one is done', async () => {
    let c1 = c.create()

    c1.log('hello 1')
    verify(console.log('hello 1')).once()
    c.done(c1)
    await nextTick()

    let c2 = c.create()

    c2.log('hello 2')
    verify(console.log('hello 2')).once()
  })

  it('should not output from discarded console', async () => {
    let c1 = c.create()
    c1.log('hello 1')
    let c2 = c.create()
    c2.log('hello 2')
    let c3 = c.create()
    c3.log('hello 3')

    verify(console.log('hello 1')).once()

    c.discard(c2)

    c.done(c1)
    await nextTick()
    verify(console.log('hello 3')).once()

    c.done(c3)
    await nextTick()
    verify(console.log('hello 2')).never()
  })
})
