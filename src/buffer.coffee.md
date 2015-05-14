    Queue = require './queue'



    module.exports =




## [Buffer]()

Reference implementation for channel buffers with optional transducer.


##### Notes

Expanding transduction steps may cause the buffer to become overfilled.

`Sliding` and `Dropping` buffers should never flag `FULL`.

> The term `FULL` is confusing: in the context of channels it is a description
  of the channel’s behavior (i.e., whether it will detain a sender) rather than
  a spatial characteristic of the underlying data store. But in the context of
  the store itself (i.e. buffers), where there is *only* the spatial aspect,
  this usage may be counterintuitive.

---

    class Buffer

      # Bit-enum values must match those in Channel
      EMPTY  = 0x08
      FULL   = 0x04

      mask   = EMPTY | FULL


### Constructor

      constructor: (@size, transducer) ->
        @flags      = if @size > 0 then EMPTY else mask
        @queue      = if @size? then new Queue # TODO: try Ring, compare perf
        @transform  = transducer? this
        @channel    = null



### Methods


#### Transform protocol

      '@@transducer/result' : (b) -> b
      '@@transducer/step'   : (b,x) -> b.queue.enqueue x; b


#### State predicates

      isEmpty : -> @queue.length is 0
      isFull  : -> @queue.length >= @size


#### [ingest]()

      ingest: (input) ->
        if @transform?
          result = @transform['@@transducer/step'] this, input
          do @channel.close if result?['@@transducer/reduced']
          result
        else
          @queue.enqueue input
          input


#### [update]()

      update: ->
        @flags = (if @isEmpty() then EMPTY else 0) |
                 (if @isFull() then FULL else 0)
        @channel.flags = @channel.flags & ~mask | @flags & mask
        return


#### [close]()

Allow upstack stateful transducers to clean up after themselves.

      close: ->
        @transform?['@@transducer/result'] this
        return


#### [enqueue]()

      enqueue: (input) ->
        throw new Error unless not @isFull() or @size is 0
        @ingest input
        do @update
        yes


#### [dequeue]()

      dequeue: ->
        throw new Error unless not @isEmpty()
        value = @queue.dequeue()
        do @update
        value



### Subclasses

      class @Sliding extends this
        isFull: -> no
        enqueue: (input) ->
          @ingest input
          do @queue.dequeue while @queue.length > @size
          do @update
          yes

      class @Dropping extends this
        isFull: -> no
        enqueue: (input) ->
          if @queue.length < @size
          then @ingest input; do @update; yes
          else no



### Exported functions

      @fixed    = (size, transducer) => new this size, transducer
      @sliding  = (size, transducer) => new @Sliding size, transducer
      @dropping = (size, transducer) => new @Dropping size, transducer
