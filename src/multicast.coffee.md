    {proc, chan, receive, send, final} = require './'
    {pooled, Generator} = require './helpers'



    module.exports =



## Multicast

    class Multicast


### Constructor

`source` is an **outlet** from which values to be distributed are received.

`relays` is a set of `Relay` objects, which hold references to the multicast
targets, the channels to which values from `source` will be distributed.

`size` is the total number of active `relays`.

`remaining` is the number of target channels still blocking the async `send`
operation; this must reach zero before the next value from `source` can be
distributed.

`completed` is a synchronization channel which notifies the distribution loop
that the current `source` value has been conveyed to all target channels.

`onDelivery` is the callback invoked every time a multicast value is delivered
into one of the target channels.

      constructor: (@source) ->
        @relays     = {}
        @size       = 0
        @remaining  = 0
        @completed  = chan()

        @onDelivery = (channel, stillOpen) =>
          if --@remaining is 0 then send.async @completed
          if not stillOpen then @remove channel

Spawn a new process on a `MulticastGenerator`. This is equivalent to a process
running the generator function:

> ```coffee
        proc =>
          until final value = yield @source
            @remaining = @size
            for id, {channel} of @relays
              send.async channel, value, @onDelivery
            yield @completed if @size > 0
          for id, relay of @relays
            if relay.shouldClose then relay.channel.close value
            do relay.free
          do @reset
          return
  ```

        proc new MulticastGenerator this



### Private classes


#### MulticastGenerator

      class MulticastGenerator extends Generator
        constructor: (@mult) -> super

        next: (value) -> loop then switch ++@_step
          when 1
            return @yield receive @mult.source
          when 2
            if final()
              for id, relay of @mult.relays
                relay.channel.close value if relay.shouldClose
                do relay.free
              do @mult.reset
              return @return()
            else
              @mult.remaining = @mult.size
              for id, {channel} of @mult.relays
                send.async channel, value, @mult.onDelivery
              @_step = 0
              if @mult.size > 0
                return @yield receive @mult.completed


#### Relay

      pooled class Relay
        constructor: (@channel, @shouldClose) ->



### Methods

      add: (channel, shouldClose = yes) ->
        ch = channel._in?() ? channel
        @size++ unless @relays[ch.id]?
        @relays[ch.id] = Relay.alloc ch, shouldClose
        this

      remove: (channel) ->
        ch = channel._in?() ? channel
        if relay = @relays[ch.id]
          do relay.free
          delete @relays[ch.id]
          @size--
        this

      reset: ->
        @relays = {}
        @size   = 0
        this
