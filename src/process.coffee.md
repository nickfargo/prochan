    Awaiter = require './awaiter'
    Channel = require './channel'
    Queue   = require './queue'


    module.exports =




## Process

A **logical process** is a steppable, suspendable, independently executable
routine, which both *communicates* with other logical processes exclusively via
operations that [`send`][] and [`receive`][] data over **channels**, and
*synchronizes* with other processes by suspending execution as necessary until
such a channel operation can be facilitated.

A `Process` instance wraps an *iterable* object. Conventionally the iterable
object is expressed as a `generator` function that must `yield` immediately
upon invoking any **channel operation** such as `send`, `receive`, or
[`select`][]. With respect to a process, a channel operation is *non-blocking*
if it can be facilitated immediately, and *blocking* if it cannot.

A process that is `BLOCKED` is waiting for a channel operation to complete, and
is situated in that channel’s **await queue**.

A process that is `SCHEDULED` is situated in the process **run queue**.

A **process run** corresponds to a single invocation of the [`ioc`][] function
on the process that is `RUNNING`, and thus is the unique **current process**.
The process’s `generator` function will run through any iterations that `yield`
following a *non-blocking channel operation*, and on either to the next
*blocking channel operation*, at which point the process will become `BLOCKED`
via [`Process::block`][], or to completion, upon which the process will become
`TERMINATED` via [`Process::exit`][].

Process runs are *batched*, such that during a single turn of the environment’s
event loop, up to a certain limited number of *process runs* are performed on
processes pulled from the *run queue*.

    class Process extends Awaiter

Process state constants.

      INCIPIENT   = 0x01
      SCHEDULED   = 0x02
      RUNNING     = 0x04
      BLOCKED     = 0x08
      TERMINATED  = 0x10
      ERROR       = 0x20

Absolute maximum number of *process runs* to execute before control is yielded
back to the environment.

      BATCH_SIZE  = 1024

Top-level process variables and collections.

      uid         = 0
      current     = null
      batchId     = null
      table       = {}
      runqueue    = new Queue



### Constructor

> Called from [`Process.spawn`][].

      constructor: (generator, args) ->
        super

        @id = 'p' + ++uid

        if @parent = current
          (@parent.children ?= {})[@id] = this
        @children = null

        @flags = INCIPIENT

        if typeof generator is 'function'
          generator = generator.apply this, args
        if typeof generator.next isnt 'function'
          throw new Error "Invalid generator"
        @iterator = generator

        @cin  = null
        @cout = null

        table[@id] = this



### Private functions


#### schedule

> Called from [`Process::proceed`][].

Schedules a process `p` for execution by pushing it onto the **run queue** and
ensuring that a batch of **process runs** will be performed on the next turn of
the environment’s event loop.

      schedule = (p) ->
        p.flags = SCHEDULED
        runqueue.enqueue p
        batchId ?= setImmediate batch
        return


#### batch

> Called from [`schedule`][].

Performs a **process run** on each process in a finite batch of processes
pulled sequentially from the **run queue**. The number of processes to be run
is capped absolutely by `BATCH_SIZE`.

      batch = ->
        n = 0
        while runqueue.length
          ioc runqueue.dequeue()
          break if ++n >= BATCH_SIZE
        batchId = if runqueue.length then setImmediate batch else null
        return


#### ioc

> Called from [`batch`][].

The inversion-of-control loop performs a single **process run** on process `p`
by stepping through its `iterator` until the associated generator function
either `yield`s to a blocking channel operation or `return`s.

      ioc = (p) ->
        return if p.flags & TERMINATED
        do p.throw if ~p.flags & SCHEDULED
        p.flags = RUNNING
        current = p
        try loop
          { value, done } = p.iterator.next p.value
          p.exit value if done
          break if ~p.flags & RUNNING
        catch error
          p.kill error
        finally
          current = null
        return



### Static functions


#### spawn

      @spawn = (generator, args) ->
        throw new Error "Arity" if arguments.length is 0
        p = new Process generator, args
        do p.proceed
        p


#### current

      @current = ->
        if current?.flags & RUNNING
          current
        else
          Process.throw "Not in process", current


#### throw

      @throw = (message = "<no message>", p) ->
        if p?
          message = """
            #{message}
            ---
            Process:  #{p.id}
            State:    (#{p.flagsToString()})
            """
        throw new Error message


#### list

      @list = -> (p.toString() for id, p of table).join '\n'


#### tree

      @tree = -> (p.toTree() for id, p of table when not p.parent?).join ''



### Methods

      throw: (message) -> Process.throw message, this


#### I/O

Private accessors to the I/O channels of the `Process`.

      _in:  -> @cin  ?= new Channel
      _out: -> @cout ?= new Channel

Public accessors to the attenuated I/O ports.

      in:  -> @_in().in()
      out: -> @_out().out()

I/O channel state predicates.

      canProcessReceive: -> !@cin? or !!@cin.canProcessReceive()
      canProcessSend:    -> !@cout? or !!@cout.canProcessSend()
      isClosed:          -> !!@cin?.isClosed()
      isDone:            -> !!@cout?.isDone()

Providing a `Process` to an operation that expects a [`Channel`][] will route
the communication to the process’s I/O ports.

      enqueue: (sender, value) ->
        if @flags & TERMINATED
          sender.register no, yes
        else
          @_in().enqueue arguments...

      dequeue: (receiver) ->
        if @flags & TERMINATED and not @cout?
          receiver.register @value, yes
        else
          @_out().dequeue arguments...


#### Process state predicates

      isScheduled:  -> !!( @flags & SCHEDULED )
      isRunning:    -> !!( @flags & RUNNING )
      isBlocked:    -> !!( @flags & BLOCKED )
      isTerminated: -> !!( @flags & TERMINATED )


#### block

> Called from [`Channel::detain`][], [`Selector::next`][].

Causes [`ioc`][] to break its loop of stepping through the process `iterator`.
The process will resume when the blocking channel calls [`Process::proceed`][].

      block: ->
        super
        do @throw unless @flags & RUNNING
        @flags = BLOCKED
        this


#### proceed

> Called from [`Process.spawn`][], [`Channel::dispatch`][],
  [`Selector::proceedWith`][].

Either starts a process or completes a channel operation that the process has
been awaiting, and schedules the incipient or unblocked process to be run.

Arguments `value` and `isFinal` convey the payload and channel state,
respectively, of the instigating channel operation:

- For a completed **receive** operation these correspond to the received value,
  and a signal indicating whether the channel is **done**.

- For a completed **send** operation these correspond to a signal indicating
  whether the sent value was accepted into the channel, and a signal indicating
  whether the channel has been **closed**.

Returns the process’s previously held `value` to the call site; this is how a
blocked **sender** process conveys its value to be sent into the channel.

      proceed: (value, isFinal = no) ->
        do @throw unless @flags & (INCIPIENT | BLOCKED)
        @awaitee = null
        prior = @value
        @register value, isFinal
        schedule this
        prior


#### exit

Orphans each child process before terminating normally.

      exit: (value) ->
        if @children?
          for pid, child of @children then child.parent = null
          @children = null

        @kill null, value


#### kill

Terminates the process and propagates termination to all child processes.

      kill: (error = null, value) ->
        @flags = TERMINATED

        if error?
          @flags |= ERROR
          @value = error
        else
          @value = value

        @cin?.close?()
        @cout?.close value

        if @children?
          child.kill error, value for pid, child of @children

        delete @parent?.children[@id]
        delete table[@id]

        if error?
          console.log error
          throw error
        value



### Diagnostics

      toString: -> """
        [object Process] {
          id:       #{@id}
          state:    #{@flagsToString()}
          parent:   #{@parent?.id ? null}
          children: [#{id for id of @children}]
          I/O:      #{@cin?.id ? null}/#{@cout?.id ? null}
        }
        """

      toJSON: -> JSON.stringify
        type     : "Process"
        id       : @id
        state    : @flagsToString()
        parent   : @parent?.id ? null
        children : (id for id of @children)
        IO       : [@cin?.id ? null, @cout?.id ? null]

      toTree: (indent = 0) ->
        s =  "#{'  '.repeat indent}#{@id} #{@flagsToString()}"
        s += " #{@awaitee.direction()}#{@awaitee.id}" if @awaitee?
        s += " (#{@cin?.id ? null}/#{@cout?.id ? null})" if @cin? or @cout?
        s += "\n"
        s += p.toTree indent + 1 for id, p of @children
        s

      flagsToString: ->
        flags = {INCIPIENT, SCHEDULED, RUNNING, BLOCKED, TERMINATED, ERROR}
        n = 0; str = (n++; k for k,v of flags when @flags & v).join ' | '
        if n is 1 then str else "(#{str})"





[`send`]: index.coffee.md#send
[`receive`]: index.coffee.md#receive
[`select`]: selector.coffee.md#select
[`schedule`]: #schedule
[`batch`]: #batch
[`ioc`]: #ioc
[`Process.spawn`]: #spawn
[`Process::block`]: #block
[`Process::proceed`]: #proceed
[`Process::exit`]: #exit
[`Channel`]: channel.coffee.md
[`Channel::detain`]: channel.coffee.md#detain
[`Channel::dispatch`]: channel.coffee.md#dispatch
[`Selector::next`]: selector.coffee.md#next
[`Selector::proceedWith`]: selector.coffee.md#proceedwith
