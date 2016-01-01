    {attenuate} = require './helpers'

    Buffer = require './buffer'



    module.exports =




## Channel

A **channel** is a queue over space and time, responsible for both *conveying*
values from one **logical process** to another, and also for *synchronizing*
the execution of processes between each communication.

From a channel’s perspective, logical processes are abstracted as a general
[`Awaiter`][] type, whose subtypes include: **(1)** actual [`Process`][]es,
**(2)** the [`Callback`][] objects used by async channel operations, and
**(3)** [`Operation`][] candidates declared inside a [`select`][] expression.

Channel operations (e.g. `send`, `receive`) take an `Awaiter` as their first
argument and, depending on channel state, may cause that `Awaiter` to become
[`detain`][]ed in the channel’s **await queue** until the channel is ready to
perform the operation.


    class Channel

      uid = 0


##### Flags and channel state

Essential channel state is represented as five bits inside a `flags` integer.

`CLOSED` is set permanently by calling [`close`][], which prevents further
[`send`][] operations on the channel.

`EMPTY` and `FULL` are reflections of the state of the channel’s [`Buffer`][],
and more precisely, indications as to how the channel will behave in response
to a channel operation. A channel with a non-fixed buffer (e.g. sliding,
dropping) can always immediately perform a `send`, and accordingly can never
be `FULL`. An unbuffered channel is always both `EMPTY` and `FULL`.

`PUSHED` and `PULLED` indicate the direction of the **await queue**, which is
comprised of [`Awaiter`][]s that are, respectively, either all **senders** or
all **receivers**. At any instant, a channel may be `PUSHED` by a queue of
senders, `PULLED` by a queue of receivers, or neither, but never both.

> *Further reading:* **[“The bits of channel state”][0]**

      CLOSED = 0x10
      EMPTY  = 0x08
      FULL   = 0x04
      PUSHED = 0x02
      PULLED = 0x01



### Constructor

      constructor: (buffer, transducer) ->
        @id = 'ch' + ++uid

If only a transducer is supplied, the channel is automatically provided with a
**zero buffer**, which allows the channel to synchronize processes as if it
were unbuffered, yet also support transduction and expansion-step overfilling.

        @buffer = null
        if buffer? or transducer?
          switch typeof buffer
            when 'number'
              @buffer = new Buffer buffer, transducer
            when 'string'
              @buffer = Buffer[ buffer ] 1, transducer
            when 'function'
              transducer = buffer
              @buffer = new Buffer 0, transducer
            else
              @buffer = buffer ? new Buffer 0, transducer
          @buffer.channel = this

Essential aspects of the channel’s state are encoded by the `flags` integer.

        @flags = @buffer?.flags ? (EMPTY | FULL)

The **await queue** is a doubly-linked list, whose ends are `head` and `tail`,
comprised of [`Awaiter`][]s. The *direction* of the await queue is specified by
the presence of either the `PUSHED` or `PULLED` bit in `flags`, which indicates
whether the queued awaiters are either all **senders** or all **receivers**,
respectively.

        @head = null
        @tail = null

The **result** of a channel is conveyed to **receivers** once the channel is
**done**, i.e. is both **closed** and **empty**. By default this value is
`undefined`, but may be set to any value exactly once in the call to
[`close`](#close).

        @result = undefined



### Private classes


#### Inlet, Outlet

Attenuations of a `channel`’s inbound and outbound ports.

      class Inlet
        Inlet = attenuate 'enqueue detain cancel canProcessSend isClosed close'
        in: -> this

      class Outlet
        Outlet = attenuate 'dequeue detain cancel canProcessReceive isDone'
        out: -> this



### Methods


#### Channel state predicates

Quickly computable specific queries into the current state of the channel.

*See:* **[“The bits of channel state”][0]**

      stateIsValid:       -> 1 << @flags & 0x11117351
      canProcessSend:     -> 1 << @flags & 0x00002301
      canProcessReceive:  -> 1 << @flags & 0x00114051
      isClosed:           -> 1 << @flags & 0x11110000
      isDone:             -> 1 << @flags & 0x11000000


#### in, out

      in: -> new Inlet this
      out: -> new Outlet this


#### close

> (`result`: any) → `result`|`undefined`

Seals off `this` channel’s **inlet**, preventing any further [`send`][]
operations, and [`dispatch`][]es any awaiting senders or receivers. Remaining
buffered values may continue to be [`receive`][]d in the future. Once the
channel is **empty**, it will convey `result` to all subsequent `receive`
operations.

##### State table

> For each of the state tables below: a binary value in **boldface** is an
  *essential* bit (column) of a particular case / condition set (row); those in
  normal weight are, with respect to channel semantics, *logical implications*
  of the essential bits; an empty cell denotes a bit that is variable, or
  *inessential* to a particular case’s definition.

`flags`        | `CLOSED`  |  `EMPTY`  |  `FULL`   | `PUSHED`  | `PULLED`  |
-------------- |:---------:|:---------:|:---------:|:---------:|:---------:|
0, 4, 8, 12    |   **0**   |           |           |   **0**   |   **0**   |
6, 14          |     0     |           |     1     |   **1**   |     0     |
9, 13          |     0     |     1     |           |     0     |   **1**   |
16, 20, 24, 28 |   **1**   |           |           |     0     |     0     |

      close: (result) ->
        switch @flags
          when 0, 4, 8, 12 then break
          when 6, 14
            @dispatch no, yes while @head
          when 9, 13
            if @buffer?
              while not @buffer.isEmpty() and @head
                @dispatch @buffer.dequeue(), no
            @dispatch result, yes while @head
          when 16, 20, 24, 28 then return
          else throw new Error "Invalid channel state"
        do @buffer?.close
        @flags = @flags & ~(PUSHED | PULLED) | CLOSED
        @result = result


#### enqueue

> (`sender`: Awaiter, `value`: any) → boolean

Executes or schedules the conveyance of a `value` from a `sender` to `this`
channel via its **inlet**.

###### State table

`flags`        | `CLOSED`  |  `EMPTY`  |  `FULL`   | `PUSHED`  | `PULLED`  |
-------------- |:---------:|:---------:|:---------:|:---------:|:---------:|
0, 8           |   **0**   |           |   **0**   |   **0**   |     0     |
4, 6, 12, 14   |   **0**   |           |   **1**   |           |   **0**   |
9, 13          |     0     |     1     |           |     0     |   **1**   |
16, 20, 24, 28 |   **1**   |           |           |     0     |     0     |

Paths that call `buffer.enqueue` may cause the channel to become `CLOSED`, as a
transduction step may force early termination.

      enqueue: (sender, value) ->
        switch @flags
          when 0, 8
            @buffer.enqueue value
            sender.register yes, no
          when 4, 6, 12, 14
            @detain sender, value
            no
          when 9, 13
            if @buffer?
              @buffer.enqueue value
              @dispatch @buffer.dequeue(), no until @stateIsValid()
            else # 13 only (9 cannot be unbuffered)
              @dispatch value, no
            sender.register yes, no
          when 16, 20, 24, 28
            sender.register no, yes
          else throw new Error "Invalid channel state"


#### dequeue

> (`receiver`: Awaiter) → any

Executes or schedules the conveyance of a `value` from `this` channel via its
**outlet** to a `receiver`.

###### State table

`flags`        | `CLOSED`  |  `EMPTY`  |  `FULL`   | `PUSHED`  | `PULLED`  |
-------------- |:---------:|:---------:|:---------:|:---------:|:---------:|
0, 4, 16, 20   |           |   **0**   |           |   **0**   |     0     |
6              |   **0**   |   **0**   |     1     |   **1**   |     0     |
8, 9, 12, 13   |   **0**   |   **1**   |           |   **0**   |           |
14             |   **0**   |   **1**   |     1     |   **1**   |     0     |
24, 28         |   **1**   |   **1**   |           |     0     |     0     |

Paths that call `buffer.enqueue` may cause the channel to become `CLOSED`, as a
transduction step may force early termination.

      dequeue: (receiver) ->
        switch @flags
          when 0, 4, 16, 20
            value = @buffer.dequeue this
          when 6
            value = @buffer.dequeue this
            @buffer.enqueue @dispatch yes, no until @stateIsValid()
          when 8, 9, 12, 13
            @detain receiver
          when 14
            if @buffer?
              @buffer.enqueue @dispatch yes, no until @flags isnt 14
              return @dequeue receiver # will recur only once
            else
              value = @dispatch yes, no
          when 24, 28
            if @buffer? then @buffer = null
            done = yes
            value = @result
          else throw new Error "Invalid channel state"
        receiver.register value, done or no


#### detain

Adds `awaiter` to the **await queue**, causing it to `block` until the channel
is ready to communicate with it.

If called with one argument then `awaiter` is a **receiver**. If called with
two arguments then `awaiter` is a **sender** conveying a `value`.

      detain: (awaiter, value) ->
        @flags |= if arguments.length < 2 then PULLED else PUSHED
        @tail =
          if awaiter._prev = @tail
          then @tail._next = awaiter
          else @head = awaiter
        awaiter.block this, value


#### dispatch

Releases the `head` [`Awaiter`][] from the **await queue** and fulfills its
communication request.

A **receiver** will `proceed` with the `value` it was awaiting, along with a
boolean `isFinal` indicating whether the channel is now **done**.

A **sender** will `proceed` with a boolean `value` indicating whether the value
it sent was indeed accepted into the channel, along with a boolean `isFinal`
indicating whether the channel is now **closed**.

      dispatch: (value, isFinal) ->
        awaiter = @head
        if @head = awaiter._next
          @head._prev = awaiter._next = null
        else
          @tail = null
          @flags &= ~(PUSHED | PULLED)
        awaiter.proceed value, isFinal


#### cancel

> (`operation`: Operation) → `null`

Extracts an `operation` from the **await queue**.

Called from [`Operation::free`][], in turn from [`Selector/clear`][], after a
**selector** has committed to one of its operations.

> Could this be generalized to `Awaiter`? Might `Callback`s also need `cancel`?

      cancel: (operation) ->
        {_prev, _next} = operation

        if operation is @head
          unless @head = _next
            @flags &= ~(PUSHED | PULLED)
        else
          _prev?._next = _next

        if operation is @tail
          @tail = _prev
        else
          _next?._prev = _prev

        operation._prev = operation._next = null


### Diagnostics

      toString: -> """
        [object Channel] {
          id:     #{@id}
          state:  #{@flagsToString()}
          buffer: #{@buffer?.queue?.length ? null}/#{@buffer?.size ? null}
          head:   #{@head?.id ? @head?.constructor.name ? null}
          tail:   #{@tail?.id ? @tail?.constructor.name ? null}
        }
        """

      flagsToString: ->
        flags = {CLOSED, EMPTY, FULL, PUSHED, PULLED}
        str = (k for k,v of flags when @flags & v).join ' | '
        "(#{str})"

      direction: -> switch @flags & (PUSHED | PULLED)
        when 0 then ''
        when PUSHED then '->'
        when PULLED then '<-'
        else '!!'



[0]: https://gist.github.com/nickfargo/8a89b237c09ee8af0fc5


[`close`]: #close
[`dispatch`]: #dispatch

[`Awaiter`]: awaiter.coffee.md
[`Buffer`]: buffer.coffee.md
[`Callback`]: callback.coffee.md
[`Operation`]: operation.coffee.md
[`Operation::free`]: operation.coffee.md#free
[`Selector/clear`]: selector.coffee.md#clear
[`Process`]: process.coffee.md

[`send`]: index.coffee.md#send
[`receive`]: index.coffee.md#receive
[`select`]: selector.coffee.md#select
