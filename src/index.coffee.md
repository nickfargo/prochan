## index

This is the entry-point module that defines all of **prochan**’s exported
functions.

    Process   = require './process'
    Channel   = require './channel'
    Buffer    = require './buffer'
    Selector  = require './selector'
    Callback  = require './callback'

    {alias, Generator} = require './helpers'




### proc

> (`options?`: Object, `generator`: {Function | Iterator}, `args?`: Array) →
  [`Process`][]

Spawns a new `Process` whose `parent` is the **current process**, and schedules
it into the global **run queue**. I/O channels may be set by `options`, keyed
to {`in`, `out`}; required `generator` may be an iterator instance or generator
function to which optional `args` are supplied.

    proc = Process.spawn


#### proc.async

> (`generator`: Function) → (`...args`) → void

Translates a [`proc`][]-able `generator` function into a Node-style async
function.

The returned function takes the arguments provided to `generator` and appends a
`callback` with the conventional `(error, ...args)` signature.

    proc.async = do ->

      class Async extends Generator
        constructor: (@generator, @args, @callback) -> super

        next: (input) -> switch ++@_step
          when 1
            @yield receive proc @generator, @args
          when 2
            try output = @callback null, input
            catch error then @callback error
            @return output

> The returned function includes a blank parameter (`_`) to satisfy consumers
that respond to callbacks differently based on their parameter count. E.g.:
Mocha only runs a test asynchronously if its containing function bears a
parameter (nominally “`done`”), and otherwise runs the test synchronously.

      async = (generator) -> (_) ->
        g = (args..., callback) -> new Async generator, args, callback
        proc g, arguments
        return


#### I/O delegates

These are functions mounted onto [`proc`][] that delegate to the I/O channels
of the current process. This allows the `proc` binding itself to act as a
proxied reference to the I/O aspects of the current process, from within the
process’s own generator function.

    do ->
      f = (name) -> -> Process.current()[name] arguments...
      for name in "enqueue dequeue
                   isClosed isDone
                   canProcessReceive canProcessSend".split /\s+/
        proc[name] = f name
      return


#### proc.list

Reports process state of all live processes.

    proc.list = Process.list


#### proc.tree

Hierarchically reports live processes.

    proc.tree = Process.tree



### go

> (`generator`: Function | Iterator, `args?`: Array) → [`Outlet`][]

Like [`proc`][] spawns a [`Process`][], but returns its I/O **channel outlet**.
The final value [`receive`][]d from the channel outlet will be the return value
of the spawned process.

    go = ->
      p = Process.spawn arguments...
      p.out()



### chan

> (`buffer?`: Number, `transducer?`: Function) → [`Channel`][]

Creates a `Channel` with optional buffering and input transformation.

    chan = (buffer, transducer) ->
      ch = new Channel buffer, transducer


#### chan.fixed, chan.sliding, chan.dropping

> (`buffer?`: Number, `transducer?`: Function) → [`Channel`][]

Creates a `Channel` with one of the built-in [`Buffer`][] types.

    for name in ['fixed', 'sliding', 'dropping']
      fn = Buffer[name]
      chan[name] = do (fn) -> (size, rest...) -> chan (fn size), rest...


#### chan.single

> Alias: `chan.promise`

Returns a [`Channel`][] that will immediately `close` with the first value
sent to it.

Acts as a *promise*, in that, if a value has not yet been sent, then processes
that [`receive`][] from the channel will block, and once a value has been sent,
processes will thenceforth immediately `receive` that value from the channel.

    chan.single = (transducer) ->
      ch = chan null, transducer
      receive.async ch, callback = (value) ->
        if ch.buffer?
          do ch.buffer.close
          ch.buffer = null
        ch.flags |= 8 # EMPTY
        ch.close value
      ch


#### chan.lift

Translates a Node-style async function `fn` into an equivalent channel-based
function.

The returned function’s parameters match those of `fn`, excluding the final
*callback*. A [`Channel`][] is returned, which will close with the value of the
non-error argument(s) passed to the `callback` accepted by `fn`.

    chan.lift = (fn, options) ->
      {error, singular} = options if options?
      error ?= yes; singular ?= yes
      (args...) ->
        ch = chan.single()
        callback =
          if error
            if singular
              (err, value) ->
                throw err if err?
                send.async ch, value
            else
              (err, values...) ->
                throw err if err?
                send.async ch, values
          else
            if singular
              (value) -> send.async ch, value
            else
              (values...) -> send.async ch, values
        fn.call this, args..., callback
        ch


#### chan.from

Returns a buffered channel filled with the contents of the provided `array`.

    chan.from = (array) -> chan Buffer.from array



### final

> (…) → boolean

Predicate typically called immediately after a `yield receive(...)` channel
operation to report whether that channel is now **done**, i.e. both *closed*
and *empty*. When called after a `yield send(...)` channel operation, returns
the negation of the yielded boolean value, i.e., whether the channel is now
**closed**.

Idiomatic usage may include calling `final` with a channel operation and
assigment as its (ignored) argument expression, e.g.:

> `while ( !final( value = yield receive( channel ) ) ) {...}`

    final = -> Process.current().isFinal



### receive

> Aliases: `take`, `get`

> (`channel?`: {[`Channel`][] | [`Process`][]}) → void

Starts a **receive** channel operation on the **current process**.

The current process must suspend (e.g. with `yield`) immediately upon calling,
and will **await** the `channel` if no `value` is immediately available. The
received `value` is conveyed upon continuation.

> `value = yield receive( channel )`

If `channel` is another `Process`, the operation will receive from the
**output channel** of that process. If no `channel` is specified, the operation
will receive from the **input channel** of the current process.

    receive = ->
      switch arguments.length
        when 0 then receive.$0 arguments...
        when 1 then receive.$1 arguments...
        else throw new Error "Arity"
      return
    receive.$0 = -> p = Process.current(); p._in().dequeue p
    receive.$1 = (channel) -> channel.dequeue Process.current()


#### receive.async

[`Callback`][] version of [`receive`][]. Does not need to be called from within
a process.

> `fn`: (`value`, `channel`, `done`) → void

    receive.async = (channel, fn) ->
      callback  = Callback.alloc fn
      done      = channel.isDone()
      immediate = channel.canProcessReceive()
      result    = channel.dequeue callback
      if done or immediate then callback.proceed result, done
      result


### send

> Alias: `put`

> (`channel?`: {[`Channel`][] | [`Process`][]}, `value`: any) → void

Starts a **send** channel operation on the **current process**.

The current process must suspend (e.g. with `yield`) immediately upon calling,
and will **await** the `channel` if no receiver or buffer space is immediately
available for the `value` to be sent.

> `yield send( channel, value )`

If `channel` is another `Process`, the operation will send to the
**input channel** of that process. If no `channel` is specified, the operation
will send to the **output channel** of the current process.

    send = ->
      switch arguments.length
        when 1 then send.$1 arguments...
        when 2 then send.$2 arguments...
        else throw new Error "Arity"
      return
    send.$1 = (value) -> p = Process.current(); p._out().enqueue p, value
    send.$2 = (channel, value) -> channel.enqueue Process.current(), value


#### send.async

[`Callback`][] version of [`send`][]. Does not need to be called from within a
process.

> `fn`: (`value`, `channel`, `closed`) → void

    send.async = (channel, value, fn) ->
      callback  = Callback.alloc fn
      closed    = channel.isClosed()
      immediate = channel.canProcessSend()
      result    = channel.enqueue callback, value
      if closed or immediate then callback.proceed result, closed
      return



### select

> Alias: `alts`

Creates a [`Selector`][], which reifies a **select expression**.

    {select} = Selector



### poll

Performs a [`receive.async`][] channel operation only if one can be completed
immediately. Returns the value received, or the `poll.EMPTY` sentinel if the
operation could not be performed.

    poll = ->
      switch arguments.length
        when 0 then channel = Process.current()._in()
        when 1 then [channel] = arguments
        else throw new Error "Arity"
      if channel.canProcessReceive()
        receive.async channel
      else
        poll.EMPTY
    poll.EMPTY = {}



### offer

Performs a [`send.async`][] channel operation only if one can be completed
immediately. Returns `true` if the operation could be performed, or `false`
otherwise.

    offer = ->
      switch arguments.length
        when 1 then [value] = arguments; channel = Process.current()._out()
        when 2 then [channel, value] = arguments
        else throw new Error "Arity"
      if result = !!channel.canProcessSend()
        send.async channel, value
      result



### timeout

Returns a [`Channel`][] that will be closed after a certain number of `ms`
(milliseconds).

    timeout = (ms, fn, args...) ->
      ch = chan()
      if typeof ms is 'function' then [fn, ms] = arguments
      setTimeout (=> ch.close fn?.apply this, args), ms
      ch.out()



### sleep

Wraps a `timeout` channel in a [`receive`][] operation.

> `yield sleep(1)`

    sleep = -> receive timeout arguments...



### mult



    mult = (channel) -> new Multicast channel



### merge

> (`inputs`: Array, `output?`: {[`Channel`][] | [`Process`][]}) → {`output` | [`Channel`][]}

Returns the provided `output` channel, or a new unbuffered channel by default,
whose values will be those received concurrently from each of the channels
provided by the `inputs` array.

The `output` channel will close once all `inputs` are **done**, with a final
**result value** of an array containing the `inputs` in the order that each
became *done*.

    merge = (inputs, output) -> (new Merger inputs, output).output



### Aliases and exports

Apply a map of aliases to one or more objects.

    alias
      single: 'promise'
      chan

    alias
      receive: 'get take'
      send:    'put'
      select:  'alts'

      select
      module.exports = {
        proc, chan, go, final
        receive, send, select, poll, offer
        timeout, sleep
        mult, merge
      }




### Forward imports

    Multicast = require './multicast'
    Merger    = require './merger'





[`proc`]: #proc
[`chan`]: #chan
[`receive`]: #receive
[`receive.async`]: #receiveasync
[`send`]: #send
[`send.async`]: #sendasync

[`Process`]: process.coffee.md
[`Channel`]: channel.coffee.md
[`Buffer`]: buffer.coffee.md
[`Callback`]: callback.coffee.md
[`Selector`]: selector.coffee.md
[`Inlet`]: channel.coffee.md#inlet-outlet
[`Outlet`]: channel.coffee.md#inlet-outlet
