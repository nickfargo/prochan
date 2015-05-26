    {pooled} = require './helpers'

    Awaiter = require './awaiter'



    module.exports =



## Callback

Casts a callback `fn` as an [`Awaiter`][], so that it may be queued in a
[`Channel`][], and thus participate in channel communications.

Used by ([`send.async`][]|[`receive.async`][]).

    pooled class Callback extends Awaiter

      constructor: (fn) ->
        super
        @fn = fn

      proceed: (value, isFinal) ->
        prior = @value
        @fn?.call null, value, @awaitee, isFinal
        do @free
        prior





[`Awaiter`]: awaiter.coffee.md
[`Channel`]: channel.coffee.md
[`send.async`]: index.coffee.md#sendasync
[`receive.async`]: index.coffee.md#receiveasync
