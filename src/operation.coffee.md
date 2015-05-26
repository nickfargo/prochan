    Awaiter = require './awaiter'
    {pooled} = require './helpers'


    module.exports =




## Operation

Defines a channel operation candidate for a [`Selector`][].

`Operation` itself is abstract; concrete subclasses include [`Receive`][] and
[`Send`][].

    class Operation extends Awaiter


### Constructor

An operation is associated with a `Selector`, and with a `consequent` generator
function to which control will be delegated if `this` operation is selected.

      constructor: (selector, consequent, channel, value) ->
        super # preserves property order
        @selector   = selector
        @consequent = consequent
        @channel    = channel
        @value      = value



### Methods


#### proceed

> Called from [`Channel::dispatch`][].

Forwards to `selector`, which will cause its associated `process` to `proceed`
delegated to `this.consequent` generator.

      proceed: (value, isFinal) ->
        @selector.proceedWith this, value, isFinal


#### free

Called by [`Selector/clear`][] to immediately garbage-collect its operations.

      free: -> @channel.cancel this



### Concrete subclasses

      pooled class @Receive extends this
        type: 'receive'
        isReady: -> @channel.canProcessReceive()
        detain:  -> @channel.detain this

      pooled class @Send extends this
        type: 'send'
        isReady: -> @channel.canProcessSend()
        detain:  -> @channel.detain this, @value





[`Selector`]: selector.coffee.md
[`Selector/clear`]: selector.coffee.md#clear
[`Channel::dispatch`]: channel.coffee.md#dispatch
[`Receive`]: #concrete-subclasses
[`Send`]: #concrete-subclasses
