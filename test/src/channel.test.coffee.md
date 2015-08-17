    {assert} = require 'chai'
    {proc, chan, send, receive, poll, offer, sleep} = require 'prochan'
    {async} = proc
    {comp, map, filter, mapcat, takeWhile} = require 'transducers-js'



    describe "Channel:", ->

      describe "construction:", ->

        it "creates unbuffered", ->
          ch = chan()
          assert.equal ch.constructor.name, 'Channel'
          assert not ch.buffer?

        it "creates zero-buffered", ->
          ch = chan 0
          assert ch.buffer?
          assert.equal ch.buffer.size, 0

        it "creates fixed buffered", ->
          ch = chan 42
          assert ch.buffer?
          assert.equal ch.buffer.size, 42

        it "creates dropping buffered", ->
          ch = chan.dropping 42
          assert ch.buffer?
          assert.equal ch.buffer.size, 42

        it "creates sliding buffered", ->
          ch = chan.sliding 42
          assert ch.buffer?
          assert.equal ch.buffer.size, 42


      describe "receiving:", ->

        it "yields correctly on blocking receive", async ->
          ch = chan()
          p1 = proc ->
            assert.equal undefined, opResult = receive ch
            assert.equal 42, yield opResult
          p2 = proc -> yield send ch, 42
          yield receive p1

        it "yields correctly on immediate receive", async ->
          ch = chan()
          p1 = proc -> yield send ch, 42
          p2 = proc ->
            assert.equal 42, opResult = receive ch
            assert.equal 42, yield opResult
          yield receive p2

        it "yields correctly on blocking receive before done", async ->
          ch = chan()
          p1 = proc ->
            assert.equal undefined, opResult = receive ch
            assert.equal 42, yield opResult
          p2 = proc -> yield ch.close 42
          yield receive p1

        it "yields correctly on immediate receive after done", async ->
          ch = chan()
          p1 = proc -> yield ch.close 42
          p2 = proc ->
            assert.equal 42, opResult = receive ch
            assert.equal 42, yield opResult
          yield receive p2


      describe "sending:", ->

Here the immediate result of a `send` operation is `false`, which indicates that the value could not be *immediately* enqueued into channel `ch`, implying that process `p1` is **blocked**. The asynchronous result of the `yield send` expression is `true`, which indicates that the value was indeed *eventually* enqueued successfully into `ch`, implying that `ch` is **not closed**.

        it "yields correctly on blocking send", async ->
          ch = chan()
          p1 = proc ->
            assert.equal no, opResult = send ch, 42
            assert.equal yes, yield opResult
          p2 = proc -> yield receive ch
          yield receive p2

Here the immediate result of `send` is `true`, because the channel is already being **pulled** by `p1` awaiting the `receive` operation, which causes the value from `send` to be enqueued immediately into the channel.

        it "yields correctly on immediate send", async ->
          ch = chan()
          p1 = proc -> yield receive ch
          p2 = proc ->
            assert.equal yes, opResult = send ch, 42
            assert.equal yes, yield opResult
          yield receive p1

A `send` to a channel that either is already closed or will close before the sent value can be enqueued should, in both cases, yield an immediate result of `false` to indicate asynchrony, and an eventual result of `false` to indicate that the channel was closed before the `send` could be enqueued.

        it "yields correctly on blocking send before close", async ->
          ch = chan()
          p1 = proc ->
            assert.equal no, opResult = send ch, 42
            assert.equal no, yield opResult
          p2 = proc -> yield ch.close()
          yield receive p2

        it "yields correctly on immediate send after close", async ->
          ch = chan()
          p1 = proc -> yield ch.close()
          p2 = proc ->
            assert.equal no, opResult = send ch, 42
            assert.equal no, yield opResult
          yield receive p1


      describe "Async:", ->

        it "sends to a pulled channel (9 13)", async ->
          ch = chan()
          asyncValue = null
          p1 = proc -> yield receive ch
          yield sleep 1
          send.async ch, 42, (value) -> asyncValue = value
          assert.equal 42, yield receive p1
          yield sleep 1
          assert.equal yes, asyncValue

        it "sends to a detaining channel (4 6 12 14)", async ->
          ch = chan()
          asyncValue = null
          send.async ch, 42, (value) -> asyncValue = value
          assert.equal 42, yield receive ch
          assert.equal yes, asyncValue

        it "receives from a pushed channel (6 14)", async ->
          ch = chan()
          p1 = proc -> yield send ch, 42
          yield sleep 1
          asyncValue = null
          receive.async ch, (value) -> asyncValue = value
          assert.equal yes, yield receive p1
          yield sleep 1
          assert.equal 42, asyncValue


      describe "polling:", ->
        # TODO: replace `undefined` poll result with `ch.EMPTY` sentinel?

        it "polls", ->
          ch = chan()
          send.async ch, 42
          assert.equal (poll ch), 42

        it "fails if channel is EMPTY", ->
          ch = chan 2
          assert ch.buffer.isEmpty()
          assert.equal (poll ch), undefined

        it "fails if channel is PULLED", ->
          ch = chan()
          receive.async ch
          assert.equal (poll ch), undefined


      describe "offering:", ->

        it "offers", ->
          ch = chan()
          receive.async ch
          assert.equal (offer ch, 42), yes

        it "fails if channel is FULL", ->
          ch = chan 2
          send.async ch, 42
          send.async ch, 43
          assert ch.buffer.isFull()
          assert.equal (offer ch, 44), no

        it "fails if channel is PUSHED", ->
          ch = chan()
          send.async ch, 42
          assert.equal (offer ch, 42), no

        it "fails if channel is CLOSED", ->
          ch = chan()
          receive.async ch
          do ch.close
          assert.equal (offer ch, 42), no


      describe "Transduction:", ->

        it "transforms, filters, expands, terminates", async ->
          cube    = (n) -> n * n * n
          isEven  = (n) -> n % 2 is 0
          string  = (x) -> x.toString()
          char    = (s) -> s.split ''
          toInt   = (s) -> parseInt s, 10
          notZero = (n) -> n isnt 0

          xf = comp( map cube            # 1, 8, 27, 64, 125, 216, ...
                     filter isEven       # 8, 64, 216, 512, 1000, ...
                     map string          # '8','64','216','512', ...
                     mapcat char         # '8','6','4','2','1','6', ...
                     map toInt           # 8,6,4,2,1,6,5,1,2,1,0,0,0, ...
                     takeWhile notZero ) # [8,6,4,2,1,6,5,1,2,1]

          ch = chan xf
          p1 = proc -> i = 0; yield send ch, ++i until ch.isClosed()
          p2 = proc -> yield receive ch until ch.isDone()

          assert.deepEqual [8,6,4,2,1,6,5,1,2,1], yield receive p2


      describe "single:", ->

        it "delivers without transduction", async ->
          ch = chan.single()
          assert not ch.buffer?
          pp = for i in [1..3]
            proc -> assert.equal 42, yield receive ch
          yield receive proc -> yield send ch, 42

        it "delivers with transduction", async ->
          string = (n) -> n.toString()
          char   = (s) -> s.split ''
          toInt  = (s) -> parseInt s, 10
          gtTwo  = (n) -> n > 2
          ch = chan.single comp( map string
                                 mapcat char
                                 map toInt
                                 filter gtTwo )
          assert ch.buffer?
          pp = for i in [1..3]
            proc -> assert.equal 3, yield receive ch
          yield receive proc -> yield send ch, 1337

        it "keeps its promises", async ->
          ch = chan.promise()
          p1 = proc ->
            value = yield receive ch
            assert.equal value, 42
            yield send waiter, 'p1'
          p2 = proc ->
            value = yield receive ch
            assert.equal value, 42
            yield send waiter, 'p2'
          waiter = proc ->
            n = 2
            yield receive() while n--
          sleeper = proc ->
            yield sleep 1
            yield send ch, 42
          assert.deepEqual (yield receive waiter), ['p1', 'p2']


      describe "lift:", ->

        fs = {}
        for name, fn of require 'fs' when not /_|Sync$/.test name
          fs[name] = chan.lift fn

        it "looks like sync, runs like async", async ->
          resolved = yield receive fs.realpath '.'
          text = yield receive fs.readFile 'package.json', 'utf8'
          data = JSON.parse text
          assert resolved.endsWith data.name
