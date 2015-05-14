    {pooled} = require './helpers'

    Awaiter = require './awaiter'



    module.exports =



## [Callback]()

Casts a callback `fn` as an `Awaiter`, so that it may be queued in a `Channel`,
and thus participate in channel communications.

Used by (`send.async`|`receive.async`).

    pooled class Callback extends Awaiter

      constructor: (channel, fn, context) ->
        super
        @channel = channel
        @fn      = fn
        @context = context

      proceed: (value, isFinal) ->
        result = @fn?.call @context, @channel, value, isFinal
        do @free
        result
