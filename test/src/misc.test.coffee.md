    {inspect} = require 'util'

    {assert} = require 'chai'

    {proc, chan, receive, send, final, select, sleep} = require 'prochan'
    {async} = proc



    describe "Misc:", ->


#### chan.from

      describe "chan.from", ->

        it "correctly loads small arrays", ->
          ch = chan.from [1..10]
          assert.equal ch.buffer.queue.length, 10

        it "correctly loads multi-cell size arrays", ->
          ch = chan.from [1..72]
          q = ch.buffer.queue
          assert q?
          assert.equal q.head._next._next, q.tail
          assert.equal q.tail._prev._prev, q.head
          assert.equal q.tail.array.length, 8


#### Laziness

Channel operations `receive` and `send` are performed **eagerly**, i.e., for
the current process, each application of the `run` loop greedily performs as
many yielding operations as possible, and will break only after encountering a
channel that causes the process to `block`.

Alternatively a process may be run **lazily**, by including the `yield null`
expression, which forces control to be yielded back to the scheduler, and
re-enqueues the process at the back of the global run queue.

This may be useful, for example, within long-running loop structures, so as to
cooperatively avoid causing starvation of other scheduled processes.

      describe "Laziness:", ->

        it "allows eager-to-lazy communication", async ->

          nibble = proc ->
            source = chan.from([1..3]).close()
            until final value = yield source
              yield null
              value

          gobble = proc ->
            source = chan.from([1..9]).close()
            until final value = yield source
              value

The first process to finish is `gobble`, even though `nibble` performs fewer
operations, because `nibble` iterates *lazily* as it consumes from its `source`
channel, while `gobble` iterates *eagerly*.

          {value, channel} = yield select nibble, gobble
          assert.equal channel, gobble
