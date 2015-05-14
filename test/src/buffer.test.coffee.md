    {assert, expect} = require 'chai'
    {proc, chan, send, receive} = require 'prochan'
    {async} = proc


    CLOSED      = 0x10
    EMPTY       = 0x08
    FULL        = 0x04
    PUSHED      = 0x02
    PULLED      = 0x01

    INCIPIENT   = 0x01
    SCHEDULED   = 0x02
    RUNNING     = 0x04
    BLOCKED     = 0x08
    STOPPED     = 0x10
    TERMINATED  = 0x20
    ERROR       = 0x40

    BLOCK_SIZE  = 32


    describe "Buffer:", ->

      describe "Zero:", ->

        it "behaves like an unbuffered channel", async ->
          c = chan 0
          q = c.buffer.queue
          p = proc ->
            yield send c, i for i in [1..5]
            do c.close
          yield receive proc ->
            assert c.flags is (EMPTY | FULL | PUSHED)
            assert c.head is c.tail is p
            assert q.length is 0
            assert q.offset is 0
            assert q.head is q.tail is null
            expect yield receive proc -> yield receive c for i in [1..3]
              .to.deep.equal [1..3]
            assert c.flags is (EMPTY | FULL | PUSHED)
            assert c.head is c.tail is p
            assert q.length is 0
            assert q.offset is 0
            assert q.head is q.tail is null
            expect yield receive proc -> yield receive c until c.isDone()
              .to.deep.equal [4,5]
            assert c.flags is (CLOSED | EMPTY | FULL)
            assert c.head is c.tail is null
            assert q.length is 0
            assert q.offset is 0
            assert q.head is q.tail is null


      describe "Fixed:", ->

        it "blocks senders when full", async ->
          c = chan.fixed 3
          q = c.buffer.queue
          p = proc ->
            yield send c, i for i in [1..10]
            do c.close
          yield receive proc ->
            assert c.flags is (FULL | PUSHED)
            assert c.head is c.tail is p
            assert q.length is 3
            assert q.offset is 0
            expect yield receive proc -> yield receive c for i in [1..5]
              .to.deep.equal [1..5]
            assert c.flags is (FULL | PUSHED)
            assert c.head is c.tail is p
            assert q.length is 3
            assert q.offset is 0 # because buffer was emptied during receive op
            expect yield receive proc -> yield receive c until c.isDone()
              .to.deep.equal [6..10]
            assert c.flags is (CLOSED | EMPTY)
            assert c.head is c.tail is null
            assert q.length is 0
            assert q.offset is 0


      describe "Dropping:", ->

        it "can drop", async ->
          c = chan.dropping 3
          q = c.buffer.queue
          yield receive proc -> yield send c, i for i in [1..5]
          assert q.length is 3
          assert q.offset is 0
          expect yield receive proc -> yield receive c for i in [1..3]
            .to.deep.equal [1..3]
          assert q.length is 0
          assert q.offset is 0
          assert q.head is q.tail
          yield receive proc -> yield send c, i for i in [1..5]
          assert q.length is 3
          assert q.offset is 0

        it "can span many queue blocks", async ->
          n = 2 * BLOCK_SIZE + 2
          c = chan.dropping n
          q = c.buffer.queue
          yield receive proc -> yield send c, i for i in [1..(n + 2)]
          assert q.length is n
          assert q.offset is 0
          assert q.head._next._next is q.tail
          assert q.head._next is q.tail._prev
          assert q.head is q.tail._prev._prev
          expect yield receive proc -> yield receive c for i in [1..(n - 4)]
            .to.deep.equal [1..(n - 4)]
          assert q.length is 4
          assert q.offset is (BLOCK_SIZE - 2)
          assert q.head._next is q.tail
          assert q.head is q.tail._prev
          expect yield receive proc -> yield receive c for i in [1..4]
            .to.deep.equal [(n - 3)..n]
          assert q.length is 0
          assert q.offset is 0
          assert q.head is q.tail


      describe "Sliding:", ->

        it "can slide", async ->
          c = chan.sliding 3
          q = c.buffer.queue
          yield receive proc -> yield send c, i for i in [1..5]
          assert q.length is 3
          assert q.offset is 2
          yield receive proc -> yield receive c for i in [1..3]
          assert q.length is 0
          assert q.offset is 0
          assert q.head is q.tail
          yield receive proc -> yield send c, i for i in [1..5]
          assert q.length is 3
          assert q.offset is 2

        it "can straddle two adjacent queue blocks", async ->
          c = chan.sliding 4
          q = c.buffer.queue
          yield receive proc -> yield send c, i for i in [1..(BLOCK_SIZE + 2)]
          assert q.length is 4
          assert q.offset is (BLOCK_SIZE - 2)
          assert q.head._next is q.tail
          assert q.head is q.tail._prev

        it "can span many queue blocks", async ->
          c = chan.sliding (BLOCK_SIZE + 4)
          q = c.buffer.queue
          yield receive proc ->
            yield send c,i for i in [1..(BLOCK_SIZE * 2 + 2)]
          assert q.length is (BLOCK_SIZE + 4)
          assert q.offset is (BLOCK_SIZE - 2)
          assert q.head._next._next is q.tail
          assert q.head._next is q.tail._prev
          assert q.head is q.tail._prev._prev
          expect yield receive proc -> yield receive c for i in [1..4]
            .to.deep.equal [(BLOCK_SIZE - 1)..(BLOCK_SIZE + 2)]
          assert q.length is (BLOCK_SIZE)
          assert q.offset is 2
          assert q.head._next is q.tail
          assert q.head is q.tail._prev
          do c.close
          expect yield receive proc -> yield receive c until c.isDone()
            .to.deep.equal [(BLOCK_SIZE + 3)..(BLOCK_SIZE * 2 + 2)]
          assert q.length is 0
          assert q.offset is 0
          assert q.head is q.tail
