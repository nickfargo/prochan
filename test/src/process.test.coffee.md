    {assert} = require 'chai'
    {proc, chan, send, receive, poll, offer} = require 'prochan'
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
