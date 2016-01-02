    {pooled} = require './helpers'

    Executor = require './executor'



    module.exports =



## Callback

Casts a callback `fn` as an [`Executor`][], so that it may be queued in a
[`Channel`][], and thus participate in channel communications.

Used by ([`send.async`][]|[`receive.async`][]).

    pooled class Callback extends Executor

      constructor: (fn) ->
        super
        @fn = fn

      proceed: (value, isFinal) ->
        prior = @value
        @fn?.call null, value, @awaitee, isFinal
        do @free
        prior





[`Executor`]: executor.coffee.md
[`Channel`]: channel.coffee.md
[`send.async`]: index.coffee.md#sendasync
[`receive.async`]: index.coffee.md#receiveasync
