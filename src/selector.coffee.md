    Process    = require './process'
    Operation  = require './operation'

    {isArray}  = require './helpers'



    module.exports =




## Selector

A **selector** reifies a **select expression** inside a [`Process`][].

A selector defines a collection of candidate **channel operations**, of which
*exactly one* will be performed by the associated process immediately as soon
as any [`Operation`][]’s associated [`Channel`][] is ready to proceed with
communication.

    class Selector
      { Receive, Send } = Operation

      INCIPIENT = 0x01
      ACTIVATED = 0x02
      COMMITTED = 0x04
      COMPLETED = 0x08
      IMMEDIATE = 0x10


A `Selector` is itself a generator, to be delegated (`yield* select...`) and
consumed immediately, one time only. In this way it acts as an indirection to a
`delegate` generator, the identity of which will be determined by the selection
of one of the operations.

      @::[Symbol?.iterator or '@@iterator'] = -> this



### Constructor

      constructor: ->
        @flags       = INCIPIENT
        @process     = Process.current()
        @operations  = []
        @alternative = null
        @arbiter     = null
        @delegate    = null
        @value       = undefined



### Private functions

      first    = (a) -> a[0]
      last     = (a) -> a[ a.length - 1 ]
      randomly = (a) -> a[ Math.random() * a.length | 0 ]


#### delegable

Wraps a non-function `label` value in a generator function that can produce a
`delegate` generator for the selector, where `delegate` immediately returns an
object `{label, value, channel}` to the calling generator.

> e.g.: `{label, value, channel} = yield* select.receive(ch1, 'label').(...)`

      delegable = (label) ->
        if typeof label is 'function'
        then label
        else (value, channel) ->
          next: ->
            value: {label, value, channel} # TODO: avoid allocation
            done: yes


#### destructure

Destructures raw arguments provided in the form of `(args..., consequent?)` and
if necessary casts `consequent` as a proper delegable generator function.

      destructure = do ->
        out = []
        destructure = (args..., consequent) ->
          switch typeof consequent
            when 'function' then ;
            when 'string'
              consequent = delegable consequent
            else
              args.push consequent
              consequent = delegable()
          out[0] = args
          out[1] = consequent
          out


#### commit

> Called once, from either [`Selector::next`][] or [`Selector::proceedWith`][].

Commits selector `s` to one of its `operation`s, and produces the generator to
which the selector will `delegate`.

      commit = (s, operation, value) ->
        throw new Error "Already committed" if s.flags & COMMITTED
        s.flags |= COMMITTED

        if operation?
          throw new Error "Foreign operation" if operation.selector isnt s
          s.value    = operation.value
          s.delegate = operation.consequent value, operation.channel
        else
          s.delegate = s.alternative()

        clear s
        s.alternative = null
        s.arbiter = null
        return


#### clear

> Called from [`commit`][], [`Selector::receive`][], [`Selector::send`][].

      clear = (s) ->
        do op.free for op in s.operations
        s.operations.length = 0
        return


#### iterate

> Called from [`Selector::next`][].

      iterate = (s, value) ->
        iteration = s.delegate.next value
        complete s if iteration.done
        iteration


#### complete

> Called from [`iterate`][].

      complete = (s) ->
        s.flags    = COMPLETED
        s.process  = null
        s.delegate = null
        s.value    = undefined



### Class functions


#### select

      @select = ->
        [operations, consequent] = destructure arguments...
        s = new Selector
        for op in operations
          if isArray op
          then s.send op, consequent
          else s.receive op, consequent
        s


#### receive/send

Allow chaining off [`select`][].

> e.g.: `yield* select.receive(ch1, ch2, ...).send([ch3, v], ...)`

      @select.receive = -> (new Selector).receive arguments...
      @select.send    = -> (new Selector).send arguments...


#### first/last

Preset an `arbiter`.

      @select.first = -> (new Selector).arbitrate first
      @select.last  = -> (new Selector).arbitrate last



### Methods


#### receive

Adds a [`Receive`][] [`Operation`][] to the selector.

      receive: ->
        throw new Error if ~@flags & INCIPIENT
        [channels, consequent] = destructure arguments...
        for channel in channels when channel?
          ready = channel.canProcessReceive()
          if @flags & IMMEDIATE
            if ready
              @operations.push Receive.alloc this, consequent, channel
          else
            if ready
              @flags |= IMMEDIATE
              clear this
            @operations.push Receive.alloc this, consequent, channel
        this


#### send

Adds a [`Send`][] [`Operation`][] to the selector.

      send: ->
        throw new Error if ~@flags & INCIPIENT
        [pairs, consequent] = destructure arguments...
        for [channel, value] in pairs when channel?
          ready = channel.canProcessSend()
          if @flags & IMMEDIATE
            if ready
              @operations.push Send.alloc this, consequent, channel, value
          else
            if ready
              @flags |= IMMEDIATE
              clear this
            @operations.push Send.alloc this, consequent, channel, value
        this


#### else

Declares a generator function as the final `alternative`, to which the
containing `process` will immediately delegate if all previously declared
`operations` would have otherwise caused the process to block.

Freezes `this` (i.e. prohibits further additions via [`receive`][]|[`send`][]).

      else: (alternative) ->
        throw new Error "Early" if ~@flags & INCIPIENT
        @flags &= ~INCIPIENT
        throw new Error "Late" if @flags & ACTIVATED or @alternative?
        @alternative = delegable alternative
        this


#### arbitrate

`(arbiter: Array[operation] -> operation)`

Assigns an `arbiter` function to `this` selector, to be used to select one
operation from a list of multiple operations that are immediately ready.

The `arbiter` must return one [`Operation`][] from the list of operations
provided to it, unless an `alternative` is defined on `this` selector.

      arbitrate: (arbiter) ->
        throw new Error "Late" if @flags & ACTIVATED or @arbiter?
        @arbiter = arbiter
        this


#### next

> Called from [`Process/ioc`][].

Iterator protocol `next`.

The first call seals, evaluates, and activates `this` selector.

If any `operations` are ready to be performed on their respective channels then
exactly one of these operations is selected, either by the `arbiter` function
or `randomly`. The selector `commit`s to this operation, which produces the
`delegate` generator, to which this and all subsequent calls to `next` will be
forwarded. If no `operations` are ready but an `alternative` generator function
has been defined by an `else` declaration, then the `alternative` will produce
the `delegate`.

Otherwise the selector’s `process` must block. Each of the `operations` is
`detain`ed by its channel, and the `process` will await the first operation
that becomes ready.

      next: (value) ->
        if ~@flags & ACTIVATED
          @flags = @flags & ~INCIPIENT | ACTIVATED

          # If any of the operations is ready, IMMEDIATE will already be set
          if @flags & IMMEDIATE then op = (@arbiter or randomly) @operations

          if op?
            if op.type is 'send' # TODO: suck less
              value = not op.channel.isClosed()
            commit this, op, value
            iterate this, value
          else if @alternative
            commit this
            iterate this
          else
            @process.block this
            do op.detain for op in @operations
            value: undefined, done: no # TODO: cache result object

        else
          iterate this, value


#### proceedWith

> Called from [`Operation::proceed`][], only after `this` selector has
  `block`ed its `process` to wait for one of its `operations` to become ready.

Forwards the call received by the ready `operation` from
[`Channel::dispatch`][] through to `this` selector’s awaiting `process`.

      proceedWith: (operation, value, isFinal) ->
        commit this, operation, value # invalidates and recycles `operation`
        @flags |= ACTIVATED
        @process.value = @value # because selected operation proxies process
        @process.proceed value, isFinal





[`select`]: #select
[`receive`]: #receive
[`send`]: #send
[`commit`]: #commit
[`iterate`]: #iterate
[`Selector::receive`]: #receive
[`Selector::send`]: #send
[`Selector::next`]: #next
[`Selector::proceedWith`]: #proceedwith
[`Process`]: process.coffee.md
[`Process/ioc`]: process.coffee.md#ioc
[`Operation`]: operation.coffee.md
[`Operation::proceed`]: operation.coffee.md#proceed
[`Receive`]: operation.coffee.md#concrete-subclasses
[`Send`]: operation.coffee.md#concrete-subclasses
[`Channel`]: channel.coffee.md
[`Channel::dispatch`]: channel.coffee.md#dispatch
