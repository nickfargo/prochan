    {assert} = require 'chai'
    {proc, chan, send, receive, final, poll, offer} = require 'prochan'
    {async} = proc
    {comp, map, filter, mapcat, takeWhile} = require 'transducers-js'



    describe "Process:", ->

      describe "I/O:", ->

        it "lets pass-through process act as a logical channel", async ->
          pc = proc -> loop
            value = yield receive()
            if proc.isClosed() then return value else yield send value

          p1 = proc -> assert.equal 42, yield receive pc
          p2 = proc -> yield send pc, 42
          yield receive p1

          p3 = proc -> yield send pc, 42
          p4 = proc -> assert.equal 42, yield receive pc
          yield receive p4

          p5 = proc -> assert.equal yes, yield send pc, 42
          p6 = proc -> yield receive pc
          yield receive p6

          p7 = proc -> yield receive pc
          p8 = proc -> assert.equal yes, yield send pc, 42
          yield receive p7

          pc.in().close 1337
          p9 = proc -> assert.equal 1337, yield receive pc
          yield receive p9

          assert.equal yes, pc.isClosed()
          assert.equal yes, pc.isDone()


      describe "options:", ->

        it "can specify I/O channels", async ->
          p1 = proc
            out: chan 1
            ->
              assert p1.cout?.buffer?
              assert.equal p1.cout.buffer.isEmpty(), yes
              yield send 42
              assert.equal p1.cout.buffer.isEmpty(), no
              yield send 1337
              'done'

          yield receive proc ->
            assert.equal (yield receive p1), 42
            assert.equal p1.cout.buffer.isEmpty(), no
            assert.equal (yield receive p1), 1337
            assert.equal p1.cout.buffer.isEmpty(), yes
            assert.equal (yield receive p1), 'done'
            assert p1.isDone()
            assert.equal (yield receive p1), 'done'
            return

        it "can use other processes directly as I/O channels", async ->
          pin = proc ->
            i = 0; loop then yield send ++i
            return

          pout = proc ->
            until final value = yield receive()
              yield send value.toString()

          p = proc in: pin, out: pout, ->
            until final value = yield receive()
              yield send value * 2

          yield receive proc ->
            assert.equal (yield receive p), '2'
            assert.equal (yield receive p), '4'
            # receiving from `pout` is the same as receiving from `p`
            assert.equal (yield receive pout), '6'
            assert.equal (yield receive pout), '8'
