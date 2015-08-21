    module.exports =




## Awaiter

An abstract **awaiter** is a participant in synchronized communications via
**channels**. An awaiter is, or is an indirection to, a **logical process**.
As such, a concrete `Awaiter` is either:

- an actual [`Process`][]

- a [`Callback`][] object, which wraps a function in an awaiter interface, as
  used by the operations [`send.async`][] and [`receive.async`][].

- an [`Operation`][] candidate, declared as part of a [`select`][] expression,
  that defines a potential channel operation to be performed on behalf of a
  specific [`Process`][]

Awaiters communicate exclusively by `send`ing or `receive`ing data over a
[`Channel`][]. A channel may synchronize communications between awaiters, if
necessary, by [`detain`][]ing an awaiter until the channel can perform the
communication, at which time the channel will [`dispatch`][] the detained
awaiter, allowing it to `proceed`.

    class Awaiter


### Constructor

      constructor: ->

Reference to the detaining [`Channel`][] or [`Selector`][] on which an awaiter
is blocked.

        @awaitee = null

Doubly-linked list references that implement a [`Channel`][]’s **await queue**.

        @_prev = null
        @_next = null

“Registers” from/to which data is read/written between channel operations.

`value` is either the *read source* from a **sender** or the *write target* for
a **receiver**.

`isFinal` is a boolean that conveys channel state at the time of an operation:
for a [`send`][] operation this tells whether the channel is **closed**; for a
[`receive`][] operation this tells whether the channel is **done**.

        @value   = undefined
        @isFinal = no




### Methods

      block: (@awaitee, @value) ->

      proceed: (value, isFinal) ->

      register: (value, isFinal) ->
        @isFinal = isFinal
        @value = value





[`Process`]: process.coffee.md
[`Channel`]: channel.coffee.md
[`Selector`]: selector.coffee.md
[`Callback`]: callback.coffee.md
[`send.async`]: index.coffee.md#sendasync
[`receive.async`]: index.coffee.md#receiveasync
[`Operation`]: operation.coffee.md
[`select`]: selector.coffee.md#select
[`send`]: index.coffee.md#send
[`receive`]: index.coffee.md#receive
[`detain`]: channel.coffee.md#detain
[`dispatch`]: channel.coffee.md#dispatch
