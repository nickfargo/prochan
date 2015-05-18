    {proc, chan, receive, send} = require './'
    {pooled, AbstractGenerator} = require './helpers'



    module.exports =



    class Multicast
      constructor: (@source) ->
        @relays     = {}
        @size       = 0
        @completed  = chan()
        @remaining  = 0
        @deliver    = (channel, stillOpen) =>
                        if --@remaining is 0 then send.async @completed
                        if not stillOpen then @remove channel
        proc new MulticastGenerator this


      class MulticastGenerator extends AbstractGenerator
        constructor: (mult) ->
          super
          @mult = mult

        next: (input) -> loop
          switch ++@_step
            when 1
              return @yield receive @mult.source
            when 2
              value = input
              if @mult.source.isDone()
                for id, relay of @mult.relays
                  relay.channel.close value if relay.shouldClose
                  do relay.free
                do @mult.reset
                return @return()
              else
                @mult.remaining = @mult.size
                for id, {channel} of @mult.relays
                  send.async channel, value, @mult.deliver
                @_step = 0
                if @mult.size > 0
                  return @yield receive @mult.completed


      pooled class Relay
        constructor: (@channel, @shouldClose) ->


      add: (channel, shouldClose = yes) ->
        ch = channel._in?() ? channel
        @size++ unless @relays[ ch.id ]?
        @relays[ ch.id ] = Relay.alloc ch, shouldClose
        this

      remove: (channel) ->
        ch = channel._in?() ? channel
        if relay = @relays[ ch.id ]
          do relay.free
          delete @relays[ ch.id ]
          @size--
        this

      reset: ->
        @relays = {}
        @size   = 0
        this
