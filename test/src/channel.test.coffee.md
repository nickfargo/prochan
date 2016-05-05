    {assert} = require 'chai'
    {proc, chan, send, receive, final, poll, offer, sleep} = require 'prochan'
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
          p1 = proc -> assert.equal yield ch, 42
          p2 = proc -> yield send ch, 42
          yield p1

        it "yields correctly on immediate receive", async ->
          ch = chan()
          p1 = proc -> yield send ch, 42
          p2 = proc -> assert.equal yield ch, 42
          yield p2

        it "yields correctly on blocking receive before done", async ->
          ch = chan()
          p1 = proc -> assert.equal yield ch, 42
          p2 = proc -> yield ch.close 42
          yield p1

        it "yields correctly on immediate receive after done", async ->
          ch = chan()
          p1 = proc -> yield ch.close 42
          p2 = proc -> assert.equal yield ch, 42
          yield p2


      describe "sending:", ->

        it "yields correctly on blocking send", async ->
          ch = chan()
          p1 = proc -> assert.equal yield (send ch, 42), yes
          p2 = proc -> yield ch
          yield p2

        it "yields correctly on immediate send", async ->
          ch = chan()
          p1 = proc -> yield ch
          p2 = proc -> assert.equal yield (send ch, 42), yes
          yield p1

        it "yields correctly on blocking send before close", async ->
          ch = chan()
          p1 = proc -> assert.equal yield (send ch, 42), no
          p2 = proc -> yield ch.close()
          yield p2

        it "yields correctly on immediate send after close", async ->
          ch = chan()
          p1 = proc -> yield ch.close()
          p2 = proc -> assert.equal yield (send ch, 42), no
          yield p1


      describe "Async:", ->

        it "sends to a pulled channel (9 13)", async ->
          ch = chan()
          asyncValue = null
          p1 = proc -> yield ch
          yield sleep 1
          send.async ch, 42, (value) -> asyncValue = value
          assert.equal yield p1, 42
          yield sleep 1
          assert.equal asyncValue, yes

        it "sends to a detaining channel (4 6 12 14)", async ->
          ch = chan()
          asyncValue = null
          send.async ch, 42, (value) -> asyncValue = value
          assert.equal yield ch, 42
          assert.equal asyncValue, yes

        it "receives from a pushed channel (6 14)", async ->
          ch = chan()
          p1 = proc -> yield send ch, 42
          yield sleep 1
          asyncValue = null
          receive.async ch, (value) -> asyncValue = value
          assert.equal yield p1, yes
          yield sleep 1
          assert.equal asyncValue, 42


      describe "polling:", ->

        it "polls", ->
          ch = chan()
          send.async ch, 42
          assert.equal (poll ch), 42

        it "fails if channel is EMPTY", ->
          ch = chan 2
          assert ch.buffer.isEmpty()
          assert.equal (poll ch), poll.EMPTY

        it "fails if channel is PULLED", ->
          ch = chan()
          receive.async ch
          assert.equal (poll ch), poll.EMPTY


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
          p1 = proc -> i = 0; continue while yield send ch, ++i
          p2 = proc -> value until final value = yield ch

          assert.deepEqual yield p2, [8,6,4,2,1,6,5,1,2,1]


      describe "single:", ->

        it "delivers without transduction", async ->
          ch = chan.single()
          assert not ch.buffer?
          pp = for i in [1..3]
            proc -> assert.equal yield ch, 42
          yield proc -> yield send ch, 42

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
            proc -> assert.equal yield ch, 3
          yield proc -> yield send ch, 1337

        it "keeps its promises", async ->
          ch = chan.promise()
          p1 = proc ->
            value = yield ch
            assert.equal value, 42
            yield send waiter, 'p1'
          p2 = proc ->
            value = yield ch
            assert.equal value, 42
            yield send waiter, 'p2'
          waiter = proc ->
            n = 2
            yield receive() while n--
          sleeper = proc ->
            yield sleep 1
            yield send ch, 42
          assert.deepEqual yield waiter, ['p1', 'p2']


      describe "lift:", ->

This test demonstrates a quick-and-dirty way to redefine a Node library in
terms of channels. Here we apply `lift` to all the async functions in `fs`,
creating a “lifted” library, which we then put to work inside a process.

        fs = {}
        rx = /^function (?:[\w_$]+\s*)?\([\w\s, ]*?(?:callback|cb)_?\)/
        for name, fn of require 'fs' when rx.test fn.toString()
          fs[name] = chan.lift fn

The name of this project will match the name of the directory.

        it "looks like sync, runs like async", async ->
          path = yield fs.realpath '.'
          text = yield fs.readFile 'package.json', 'utf8'
          data = JSON.parse text
          assert path.endsWith data.name
