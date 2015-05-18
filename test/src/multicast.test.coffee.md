    {assert} = require 'chai'
    {proc, chan, send, receive, mult} = require 'prochan'
    {async} = proc



    describe "Multicasting:", ->

      it "channel to channels", async ->
        ch1 = chan()
        m = mult ch1
        m.add ch2 = chan()
        m.add ch3 = chan()
        m.add ch4 = chan()
        m.add ch5 = chan()

        p1 = proc ->
          yield send ch1, i for i in [1..10]
          do ch1.close
          'foo'
        p2 = proc -> yield receive ch2 until ch2.isDone()
        p3 = proc -> yield receive ch3 until ch3.isDone()
        p4 = proc -> yield receive ch4 until ch4.isDone()
        p5 = proc -> yield receive ch5 until ch5.isDone()

        assert.equal 'foo', yield receive p1
        assert.deepEqual [1..10], yield receive p2
        assert.deepEqual [1..10], yield receive p3
        assert.deepEqual [1..10], yield receive p4
        assert.deepEqual [1..10], yield receive p5


      it "process to channels", async ->
        m = mult proc -> yield send i for i in [1..10]; 'foo'
        m.add ch2 = chan()
        m.add ch3 = chan()

        p2 = proc -> loop
          value = yield receive ch2
          if ch2.isDone() then break else value
        p3 = proc -> yield receive ch3 until ch3.isDone()

        assert.deepEqual [1..10], yield receive p2
        assert.deepEqual [1..10].concat('foo'), yield receive p3


      it "channel to processes", async ->
        ch1 = chan()
        m = mult ch1

        p1 = proc ->
          yield send ch1, i for i in [1..10]
          do ch1.close
          'foo'

        m.add p2 = proc -> yield receive() until proc.isClosed()
        m.add p3 = proc -> yield receive() until proc.isClosed()
        m.add p4 = proc -> yield receive() until proc.isClosed()

        assert.equal 'foo', yield receive p1
        assert.deepEqual [1..10], yield receive p2
        assert.deepEqual [1..10], yield receive p3
        assert.deepEqual [1..10], yield receive p4


      it "process to processes", async ->
        m = mult proc -> yield send i for i in [1..10]; 'foo'

        routine = -> loop
          value = yield receive()
          if proc.isClosed() then break else value

        m.add p1 = proc routine
        m.add p2 = proc routine
        m.add p3 = proc routine

        assert.deepEqual [1..10], yield receive p1
        assert.deepEqual [1..10], yield receive p2
        assert.deepEqual [1..10], yield receive p3
