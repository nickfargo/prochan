    {pooled} = require './helpers'



    module.exports =



## Queue

A doubly-linked list of pooled `Cell`s, each of which wrap a uniformly `SIZE`d
`array`. Operations limited to O(1) `enqueue` and `dequeue`.

    class Queue

      pooled class Cell
        @SIZE = 32
        constructor: (prev, array) ->
          @_prev = prev or null
          @_next = null
          if array?
            @array = array
          else
            @array ?= new Array Cell.SIZE
          prev?._next = this

      @from = (array) ->
        q = new Queue
        q.length = array.length
        for i in [0..q.length] by 32 # FIXME
          q.tail = Cell.alloc q.tail, array.slice i, i + 32
          q.head ?= q.tail
        q

      constructor: ->
        @head = null
        @tail = null
        @length = 0
        @offset = 0

      enqueue: (value) ->
        index = (@offset + @length) % Cell.SIZE
        if index is 0 then @tail = Cell.alloc @tail
        if @length is 0 then @head = @tail
        @tail.array[index] = value
        ++@length

      dequeue: ->
        return if @length is 0
        {offset, head} = this; {array} = head
        value = array[offset]; array[offset] = undefined
        if (@offset = (offset + 1) % Cell.SIZE) is 0
          if next = head._next
            do head.free; next._prev = null; @head = next
        if --@length is 0
          @offset = 0
          # Is free-on-empty overzealous / too thrashy?
          do @head.free; @head = @tail = null
        value
