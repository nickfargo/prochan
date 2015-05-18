    Process   = require './process'
    Channel   = require './channel'
    Buffer    = require './buffer'
    Selector  = require './selector'
    Callback  = require './callback'

    {alias} = require './helpers'

    {slice} = Array::




### [proc]()

> `(generatorFn, [args]): Process`

Spawns a new process whose `parent` is the **current process**. The new process
is immediately **scheduled** into the **run queue**.

    proc = ->
      p = Process.spawn.apply Process, arguments
      # TODO: attenuate (?), maybe all the way down to just an `id:number`


#### [proc.async]()

> `(generatorFn) → (...args): void`

Translates a `proc`-able `generator` function into a Node-style async function.

The returned function takes the arguments provided to `generator` and appends a
`callback` with the conventional signature `(error, ...args): void`.

    proc.async = do ->

      class AsyncIterator
        constructor: (@generator, @args, @callback) ->
          @step = 0
          @result = value: undefined, done: no
        next: (input) ->
          switch ++@step
            when 1
              output = receive proc @generator, @args
            when 2
              try output = @callback null, input
              catch error then @callback error
              @result.done = yes
          @result.value = output
          @result

The returned function includes a blank parameter (`_`) to satisfy consumers
that respond to callbacks differently based on their parameter count.

> e.g.: Mocha will run a test asynchronously if its containing function bears a
  parameter (nominally “`done`”), but otherwise runs the test synchronously.

      async = (generator) -> (_) ->
        g = (args..., callback) -> new AsyncIterator generator, args, callback
        proc g, arguments
        return


#### I/O delegates

Functions that delegate to the current process. These allow the current process
to be referenced from within its generator function, using a channel-like
interface.

    do ->
      f = (name) -> -> Process.current()[name] arguments...
      for name in "enqueue dequeue
                   isClosed isDone
                   canProcessReceive canProcessSend".split /\s+/
        proc[name] = f name
      return

    proc.dump = Process.dump



### [go]()

Spawns a process and returns a channel to which the spawned process will send
its return value.

    go = ->
      p = Process.spawn arguments...
      p.out()



### [chan]()

    chan = (buffer, transducer) ->
      ch = new Channel buffer, transducer


#### [chan.fixed](), [chan.sliding](), [chan.dropping]()

    for name in ['fixed', 'sliding', 'dropping']
      fn = Buffer[name]
      chan[name] = do (fn) -> (size, rest...) -> chan (fn size), rest...


#### [chan.single]()

Returns a channel that will immediately close with the first value sent to it.

    chan.single = (transducer) ->
      ch = chan null, transducer
      receive.async ch, callback = (value) ->
        if ch.buffer?
          do ch.buffer.close
          ch.buffer = null
        ch.flags |= 8 # hacking the EMPTY flag in order to `close` properly
        ch.close value
      ch



### [receive]()

    receive = ->
      p = Process.current()
      switch arguments.length
        when 0 then channel = p._in()
        when 1 then [channel] = arguments
        else throw new Error "Arity"
      channel.dequeue p


#### [receive.async]()

> Seems like the “immediate” case should not synchronously invoke the callback.

    receive.async = (channel, fn) ->
      callback  = Callback.alloc channel, fn
      immediate = channel.canProcessReceive()
      result    = channel.dequeue callback
      if immediate then callback.proceed result, channel.isDone()
      result



### [send]()

    send = ->
      p = Process.current()
      switch arguments.length
        when 1 then [value] = arguments; channel = p._out()
        when 2 then [channel, value] = arguments
        else throw new Error "Arity"
      channel.enqueue p, value


#### [send.async]()

    send.async = (channel, value, fn) ->
      callback  = Callback.alloc channel, fn
      immediate = channel.canProcessSend()
      result    = channel.enqueue callback, value
      if immediate then callback.proceed result, channel.isClosed()
      result



### [select]()

    {select} = Selector



### [poll]()

    poll = ->
      switch arguments.length
        when 0 then channel = Process.current()._in()
        when 1 then [channel] = arguments
        else throw new Error "Arity"
      if channel.canProcessReceive() then receive.async channel



### [offer]()

    offer = ->
      switch arguments.length
        when 1 then [value] = arguments; channel = Process.current()._out()
        when 2 then [channel, value] = arguments
        else throw new Error "Arity"
      if channel.canProcessSend() then send.async channel, value else no



### [timeout]()

    timeout = (ms, fn, args...) ->
      ch = chan()
      if typeof ms is 'function' then [fn, ms] = arguments
      setTimeout (=> ch.close fn?.apply this, args), ms
      ch.out()



### [sleep]()

    sleep = -> receive timeout arguments...




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
      }
