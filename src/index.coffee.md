## index

This is the entry-point module that defines all of **prochan**’s exported
functions.

    Process   = require './process'
    Channel   = require './channel'
    Buffer    = require './buffer'
    Selector  = require './selector'
    Callback  = require './callback'

    {alias, AbstractGenerator} = require './helpers'

    {slice} = Array::




### [proc]()

> (`generator`: {Function | Iterator}, `args?`: Array) → **[`Process`][]**

Spawns a new `Process` whose `parent` is the **current process**, and schedules
it into the global **run queue**.

    proc = (generator, args) -> Process.spawn arguments...


#### [proc.async]()

> (`generator`: Function) → (`...args`) → void

Translates a `proc`-able `generator` function into a Node-style async function.

The returned function takes the arguments provided to `generator` and appends a
`callback` with the conventional `(error, ...args)` signature.

    proc.async = do ->

      class AsyncGenerator extends AbstractGenerator

        constructor: (g,a,c) ->
          super; @generator = g; @args = a; @callback = c

        next: (input) -> switch ++@_step
          when 1
            @yield receive proc @generator, @args
          when 2
            try output = @callback null, input
            catch error then @callback error
            @return output

The returned function includes a blank parameter (`_`) to satisfy consumers
that respond to callbacks differently based on their parameter count.

> e.g.: Mocha will run a test asynchronously if its containing function bears a
  parameter (nominally “`done`”), but otherwise runs the test synchronously.

      async = (generator) -> (_) ->
        g = (args..., callback) -> new AsyncGenerator generator, args, callback
        proc g, arguments
        return


#### I/O delegates

Functions mounted onto `proc` that delegate to the I/O channels of the current
process. This allows the `proc` binding itself to act as a proxied reference to
the current process from within the process’s own generator function.

    do ->
      f = (name) -> -> Process.current()[name] arguments...
      for name in "enqueue dequeue
                   isClosed isDone
                   canProcessReceive canProcessSend".split /\s+/
        proc[name] = f name
      return


#### proc.dump

Reports process state of all live processes. Calling `proc.dump('tree')` lists
processes hierarchically.

    proc.dump = Process.dump



### [go]()

> (`generator`: Function | Iterator, `args?`: Array) → **[`Outlet`][]**

Like `proc`, spawns a `Process`, but returns its I/O **channel outlet**. The
final value `receive`d from the channel outlet will be the return value of the
spawned process.

    go = ->
      p = Process.spawn arguments...
      p.out()



### [chan]()

> (`buffer?`: Number, `transducer?`: Function) → **[`Channel`][]**

Creates a `Channel` with optional buffering and input transformation.

    chan = (buffer, transducer) ->
      ch = new Channel buffer, transducer


#### [chan.fixed](), [chan.sliding](), [chan.dropping]()

> (`buffer?`: Number, `transducer?`: Function) → **[`Channel`][]**

Creates a `Channel` with one of the built-in **[`Buffer`][]** types.

    for name in ['fixed', 'sliding', 'dropping']
      fn = Buffer[name]
      chan[name] = do (fn) -> (size, rest...) -> chan (fn size), rest...


#### [chan.single]()

Returns a `Channel` that will immediately `close` with the first value sent.

Acts as a *promise*, in that, if a value has not yet been sent, then processes
that `receive` from the channel will block, and once a value has been sent,
processes will thenceforth immediately `receive` that value from the channel.

> Alias: `chan.promise`

    chan.single = (transducer) ->
      ch = chan null, transducer
      receive.async ch, callback = (value) ->
        if ch.buffer?
          do ch.buffer.close
          ch.buffer = null
        ch.flags |= 8 # EMPTY
        ch.close value
      ch


#### [chan.isFinal]()

    chan.isFinal = -> Process.current().isFinal



### [receive]()

> (`channel?`: {Channel | Process}) → any

Starts a **receive** channel operation on the **current process**.

The current process must suspend (e.g. with `yield`) immediately upon calling,
and will **await** the `channel` if no `value` is immediately available. The
received `value` is conveyed upon continuation.

> `value = yield receive( channel )`

If `channel` is another `Process`, the operation will receive from the **out**
I/O channel of that process. If no `channel` is specified, the operation will
receive from the **in** I/O channel of the current process.

> Aliases: `take`, `get`

    receive = ->
      p = Process.current()
      switch arguments.length
        when 0 then channel = p._in()
        when 1 then [channel] = arguments
        else throw new Error "Arity"
      channel.dequeue p


#### [receive.async]()

**[`Callback`][]** version of `receive`. Does not need to be called from within
a process.

> `fn`: (`value`, `channel`, `done`) → void

    receive.async = (channel, fn) ->
      callback  = Callback.alloc fn
      done      = channel.isDone()
      immediate = channel.canProcessReceive()
      result    = channel.dequeue callback
      if done or immediate then callback.proceed result, done
      return


### [send]()

> (`channel?`: {Channel | Process}, `value`: any) → boolean

Starts a **send** channel operation on the **current process**.

The current process must suspend (e.g. with `yield`) immediately upon calling,
and will **await** the `channel` if no receiver or buffer space is immediately
available for the `value` to be sent.

> `yield send( channel, value )`

If `channel` is another `Process`, the operation will send to the **in** I/O
channel of that process. If no `channel` is specified, the operation will send
to the **out** I/O channel of the current process.

> Alias: `put`

    send = ->
      p = Process.current()
      switch arguments.length
        when 1 then [value] = arguments; channel = p._out()
        when 2 then [channel, value] = arguments
        else throw new Error "Arity"
      channel.enqueue p, value


#### [send.async]()

**[`Callback`][]** version of `send`. Does not need to be called from within a
process.

> `fn`: (`value`, `channel`, `closed`) → void

    send.async = (channel, value, fn) ->
      callback  = Callback.alloc fn
      closed    = channel.isClosed()
      immediate = channel.canProcessSend()
      result    = channel.enqueue callback, value
      if closed or immediate then callback.proceed result, closed
      not closed



### [select]()

Creates a **[`Selector`][]**, which reifies a **select expression**.

    {select} = Selector



### [poll]()

Performs a `receive` channel operation iff one can be completed immediately.

    poll = ->
      switch arguments.length
        when 0 then channel = Process.current()._in()
        when 1 then [channel] = arguments
        else throw new Error "Arity"
      if channel.canProcessReceive() then receive.async channel



### [offer]()

Performs a `send` channel operation iff one can be completed immediately.

    offer = ->
      switch arguments.length
        when 1 then [value] = arguments; channel = Process.current()._out()
        when 2 then [channel, value] = arguments
        else throw new Error "Arity"
      if channel.canProcessSend() then send.async channel, value else no



### [timeout]()

Returns a channel that closes after a certain number of `ms` (milliseconds).

    timeout = (ms, fn, args...) ->
      ch = chan()
      if typeof ms is 'function' then [fn, ms] = arguments
      setTimeout (=> ch.close fn?.apply this, args), ms
      ch.out()



### [sleep]()

Wraps a `timeout` channel in a `receive` operation.

> `yield sleep(1)`

    sleep = -> receive timeout arguments...



### [mult]()

    mult = (channel) -> new Multicast channel




### Aliases and exports

    alias
      single: 'promise'
      chan

    alias
      receive: 'get take'
      send:    'put'
      select:  'alts'

      select
      module.exports = {
        proc, chan, go
        receive, send, select, poll, offer
        timeout, sleep
        mult
      }




### Forward imports

    Multicast = require './multicast'





[`Process`]:   process.coffee.md
[`Channel`]:   channel.coffee.md
[`Buffer`]:    buffer.coffee.md
[`Callback`]:  callback.coffee.md
[`Selector`]:  selector.coffee.md
[`Inlet`]:     channel.coffee.md#inlet-outlet
[`Outlet`]:    channel.coffee.md#inlet-outlet
