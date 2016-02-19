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
      {Receive, Send} = Operation

      INCIPIENT = 0x01
      IMMEDIATE = 0x02
      EVALUATED = 0x04
      DELEGATED = 0x08
      COMMITTED = 0x10
      FINALIZED = 0x20


### Induction and delegation

A select expression may take the **induction form** `yield select`. In this
form, the [`Process/run`][] loop will recognize a `Selector` by calling its
`induce` implementation, which directly causes the selector to be `evaluate`d.

Moreover, a `Selector` is its own iterator. This reifies the **delegated form**
`yield* select`. In this form, channel operation `candidates` are declared and
associated with a **consequent** generator function. The selector will be
`evaluate`d automatically by [`Process/run`][] calling its `next` method. Then
when an operation is selected, its consequent is called, producing a `delegate`
generator to which the `process.iterator` is delegated.

> See also: *[Deployment methods][]*

      @::[Symbol?.iterator or '@@iterator'] = -> this

      INITIAL_ITERATOR_RESULT = value: undefined, done: no


### Constructor

      constructor: ->
        @flags       = INCIPIENT
        @process     = Process.current()
        @candidates  = []
        @alternative = null
        @arbiter     = null
        @delegate    = null
        @result      = null



### Private functions

      first    = (a) -> a[0]
      last     = (a) -> a[ a.length - 1 ]
      randomly = (a) -> a[ Math.random() * a.length | 0 ]

      destructure = (args...) ->
        switch typeof lastArg = args.pop()
          when 'function', 'string'
            consequent = lastArg
          else
            args.push lastArg if lastArg?
        [args, consequent]



### Static functions


#### select

This is exported as the user-facing `select` function.

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

      @select.first   = -> (new Selector).arbitrate first
      @select.last    = -> (new Selector).arbitrate last



### Constructive methods

These methods may only be called prior to `this` selector being `evaluate`d.


#### receive

Adds one or more [`Receive`][] [`Operation`][]s to the selector, optionally
associating a single `consequent` label or generator function with this group.

      receive: ->
        throw new Error "Late" if ~@flags & INCIPIENT
        [channels, consequent] = destructure arguments...
        for channel in channels when channel?
          noneAreReadyYet = ~@flags & IMMEDIATE
          thisOneIsReady = channel.canProcessReceive()
          if noneAreReadyYet or thisOneIsReady
            if noneAreReadyYet and thisOneIsReady
              @flags |= IMMEDIATE
              do @clear
            @candidates.push Receive.alloc this, consequent, channel
        this


#### send

Adds one or more [`Send`][] [`Operation`][]s to the selector, optionally
associating a single `consequent` label or generator function with this group.

      send: ->
        throw new Error "Late" if ~@flags & INCIPIENT
        [pairs, consequent] = destructure arguments...
        for [channel, value] in pairs when channel?
          noneAreReadyYet = ~@flags & IMMEDIATE
          thisOneIsReady = channel.canProcessSend()
          if noneAreReadyYet or thisOneIsReady
            if noneAreReadyYet and thisOneIsReady
              @flags |= IMMEDIATE
              do @clear
            @candidates.push Send.alloc this, consequent, channel, value
        this


#### else

Declares a final `alternative` label or generator function. The selector will
immediately `commit` to the alternative if none of the declared channel
operation `candidates` may be performed at evaluation time.

Freezes `this`, prohibiting further construction via [`receive`][]|[`send`][]).

      else: (alternative) ->
        throw new Error "Early" if ~@flags & INCIPIENT
        @flags &= ~INCIPIENT
        throw new Error "Late" if @flags & EVALUATED or @alternative?
        @alternative = alternative
        this


#### arbitrate

`(arbiter: Array[Operation] -> Operation)`

Assigns an `arbiter` function to `this` selector. At evaluation time, unless an
`alternative` is defined on `this` selector, this function must return one
[`Operation`][] from a provided array of `candidates` that are immediately
ready.

      arbitrate: (arbiter) ->
        throw new Error "Late" if @flags & EVALUATED or @arbiter?
        @arbiter = arbiter
        this



### Deployment methods

A `Process`’s generator function can deploy a `Selector` in one of two ways:

- By **induction** — the process generator `yield`s the selector directly to
  the [`Process/run`][] loop. After the selector `commit`s, the generator will
  proceed with a yielded `{value, channel, label}` structure.

- By **delegation** — the process generator `yield*`s into the selector. After
  the selector `commit`s to an operation, that operation’s `consequent`
  function is called with arguments `(value, channel)`, returning a generator
  to which the process generator delegates.


#### induce

> Called from [`Process/run`][].

`Inducer` interface, by which [`Process/run`][] `evaluate`s a `yield select`
expression.

If evaluation caused the selector to `commit` immediately, then it will have
produced a `result` structure, which is written directly to the `process`
*register*, from which it will be read and conveyed as the evaluation of the
`yield select` expression.

      induce: (p) ->
        throw new Error "Process mismatch" if p isnt @process
        throw new Error "Late" if @flags & EVALUATED

        do @evaluate

        if @flags & COMMITTED
          @process.value = @result


#### next

> Called from [`Process/run`][].

ES6 Iterator interface, through which [`Process/run`][] delegates to a
`yield* select` expression.

The first call to `next` `evaluate`s `this` selector.

Once `this` `Selector` `commit`s to one of its `candidates`, that selected
`Operation`’s associated `consequent` will have created a `delegate` generator,
to which each subsequent call to `next` is forwarded.

      next: (value) ->
        if ~@flags & EVALUATED
          @flags |= DELEGATED
          do @evaluate

        if ~@flags & DELEGATED
          throw new Error "Expected a delegated generator"

        if ~@flags & COMMITTED
          INITIAL_ITERATOR_RESULT
        else
          result = @delegate.next value
          do @finalize if result.done
          result



### Executive methods

Seals `this` selector, preventing addition of further operations. Proceeds to
either `commit` one of the operation `candidates` if possible, or `commit` the
`alternative` if one was defined, or else `block` the associated `process` and
await the first operation that becomes ready.

      evaluate: ->
        throw new Error "Already evaluated" if @flags & EVALUATED
        @flags = @flags & ~INCIPIENT | EVALUATED

        if @flags & IMMEDIATE
          op = (@arbiter or randomly) @candidates

        if op?
          @commit op
        else if @alternative?
          @commit null
        else
          @process.block this
          do op.detain for op in @candidates
        return


#### commit

> Called once, from [`Selector::evaluate`][] or [`Selector::proceedWith`][].

Commits `this` selector to one of its operation `candidates`. If any operation
is ready at evaluation time, then `commit` will be called immediately via
`evaluate`, and the selected `operation` will be `execute`d on its associated
`channel`, returning the `value` to be committed. Otherwise the selector’s
`process` will have blocked, and `commit` will be called during a future run
via `proceedWith`, with a `value` argument supplied by the instigating channel.

If `this` selector expresses the **induction form** `yield select`, then the
selector’s `result` is recorded as a structure containing the `operation`’s
result `value`, its `channel`, and its `consequent` interpreted as a `label`.

If `this` selector expresses the **delegated form** `yield* select`, then the
selected `operation`’s associated `consequent` must be a generator function.
This function is called and returns the generator to which the selector will
`delegate` all subsequent calls to `next` received from [`Process/run`][].

> See also: *[Deployment methods][]*, [`Operation::execute`][]

      commit: (operation, value) ->
        throw new Error "Already committed" if @flags & COMMITTED
        @flags |= COMMITTED

        if operation?
          throw new Error "Foreign operation" if operation.selector isnt this

          if @flags & IMMEDIATE
            value = operation.execute()

          {consequent, channel} = operation
          if @flags & DELEGATED
            @delegate = consequent value, channel
          else
            @result = {label: consequent, value, channel}

        else
          if @flags & DELEGATED
            @delegate = @alternative()
          else
            @result = label: @alternative, value: undefined, channel: null

        do @clear
        @alternative = null
        @arbiter = null
        return


#### proceedWith

> Called from [`Operation::proceed`][], only if `this` selector has `block`ed
  its `process`.

Forwards the `proceed` call from [`Channel::dispatch`][], received by the ready
`operation`, through to `this` selector’s awaiting `process`.

The `operation` must be one of the selector’s `candidates`, which will have
just been `dispatch`ed by its `channel`.

Before the `operation` is `commit`ted, its `operation.value` is written to the
the process `register` (i.e. its `value` field). This necessarily affects only
blocking **send** operations; recall that the *register* is simply a space in
which an awaiting sender process’s value is held until the scheduler is ready
to convey that value to another process.

> See also: [`Process::proceed`][]

      proceedWith: (operation, value, isFinal) ->
        throw new Error "Requires blocking select" if @flags & IMMEDIATE
        @process.register operation.value, isFinal
        @commit operation, value
        output = if @flags & DELEGATED then value else @result
        @process.proceed output, isFinal


#### clear

      clear: ->
        do op.free while op = @candidates.pop()
        return


#### finalize

      finalize: ->
        @flags   |= FINALIZED
        @process  = null
        @delegate = null
        @result   = null
        return





[Deployment methods]: #deployment-methods

[`select`]: #select
[`receive`]: #receive
[`send`]: #send
[`Selector::receive`]: #receive
[`Selector::send`]: #send
[`Selector::induce`]: #induce
[`Selector::next`]: #next
[`Selector::evaluate`]: #evaluate
[`Selector::commit`]: #commit
[`Selector::proceedWith`]: #proceedwith
[`Process`]: process.coffee.md
[`Process/run`]: process.coffee.md#run
[`Operation`]: operation.coffee.md
[`Operation::proceed`]: operation.coffee.md#proceed
[`Operation::execute`]: operation.coffee.md#execute
[`Receive`]: operation.coffee.md#concrete-subclasses
[`Send`]: operation.coffee.md#concrete-subclasses
[`Channel`]: channel.coffee.md
[`Channel::dispatch`]: channel.coffee.md#dispatch
