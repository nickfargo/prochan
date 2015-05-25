    module.exports =




## [Awaiter]()

An **awaiter** is an abstraction of a **logical process** that participates in
synchronized communications via **channels**.

A concrete `Awaiter` is either:

- an actual `Process`

- a `Callback` object that wraps a function, for use by the `async` variants of
  the `send` and `receive` operations.

- an `Operation` candidate, declared as part of a `select` expression, that
  defines a potential channel operation to be performed on behalf of a specific
  `Process`

Awaiters communicate exclusively by `send`ing or `receive`ing data over a
`Channel`. A channel synchronizes communicating awaiters, and may `block` and
`detain` an awaiter until the channel can facilitate the communication, at
which time the channel will `dispatch` an awaiter and allow it to `proceed`.

    class Awaiter


### Constructor

      constructor: ->
        @awaitee = null

Doubly-linked list references used to implement a `Channel`’s **await queue**.

        @_prev = null
        @_next = null

“Registers” from/to which data is read/written between channel operations.

- `value` is either the *read source* from a **sender** or the *write target*
  for a **receiver**.

- `isFinal` conveys channel state after a channel operation (`send`|`receive`)
  has yielded control back to the `Awaiter`:

```
awaiter.isFinal :: (Channel, Function) => boolean
                      = (ch, send)     => ch.isClosed()
                      = (ch, receive)  => ch.isDone()
```

        @value   = undefined
        @isFinal = no




### Methods

      block: (@awaitee, @value) ->

      proceed: (value, isFinal) ->

      register: (value, isFinal) ->
        @isFinal = isFinal
        @value = value
