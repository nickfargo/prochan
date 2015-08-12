    {assert} = require 'chai'
    {proc, chan, send, receive, select, sleep} = require 'prochan'
    {async} = proc



    describe "Selector:", ->


      describe "Scoped form:", ->

        it "selects from receive operations", async ->
          ch1 = chan()
          ch2 = chan()

          p1 = proc ->
            yield sleep 20
            yield send ch1, 'foo'

          p2 = proc ->
            {value, channel} = yield from select.receive ch1, ch2
            assert.equal 'foo', value
            assert.equal ch1, channel
            value

          assert.equal 'foo', yield receive p2
          assert.equal yes, yield receive p1


        it "selects from send operations", async ->
          ch1 = chan()
          ch2 = chan()

          p1 = proc ->
            yield sleep 1
            yield receive ch1

          p2 = proc ->
            {value, channel} = yield from select.send [ch1, 1337], [ch2, 42]
            assert.equal yes, value
            assert.equal ch1, channel
            channel

          assert.equal ch1, yield receive p2
          assert.equal 1337, yield receive p1


        it "selects from mixed receive/send operations", async ->
          ch1 = chan()
          ch2 = chan()

          p1 = proc ->
            yield sleep 1
            yield receive ch2

          p2 = proc ->
            {value, channel} = yield from select
              .receive ch1
              .send [ch2, 42]
            assert.equal yes, value
            assert.equal ch2, channel
            channel

          assert.equal ch2, yield receive p2
          assert.equal 42, yield receive p1


        it "evaluates inline form", async ->
          ch1 = chan()
          ch2 = chan()
          ch3 = chan()

          p = proc ->
            yield sleep 1
            yield send ch3, 42

          assert.equal 'foo', yield receive proc ->
            {value, channel} = yield from select [ch1, 1337], ch2, ch3
            assert.equal 42, value
            assert.equal ch3, channel
            'foo'

          assert.equal yes, yield receive p


        it "selects receive operation in chained–case form", async ->
          ch1 = chan()
          ch2 = chan()
          ch3 = chan()

          p = proc ->
            yield sleep 1
            yield send ch3, 42

          yield receive proc ->
            {value, channel} = yield from select
              .send [ch1, 1337]
              .receive ch2, ch3
            assert.equal 42, value
            assert.equal ch3, channel

          assert.equal yes, yield receive p


        it "selects send operation in chained–case form", async ->
          ch1 = chan()
          ch2 = chan()
          ch3 = chan()

          p = proc ->
            yield sleep 1
            yield receive ch2

          yield receive proc ->
            {value, channel} = yield from select
              .send [ch1, 42], [ch2, 1337]
              .receive ch3
            assert.equal yes, value
            assert.equal ch2, channel

          assert.equal 1337, yield receive p


        it "arbitrates when multiple ops are immediately ready", async ->
          ch1 = chan()
          ch2 = chan()

          p1 = proc -> yield receive ch1; assert no, "unreachable"
          p2 = proc -> assert.equal 1337, yield receive ch2

          assert.equal 'foo', yield receive proc ->
            assert p1.isBlocked(), "p1 is blocked"
            assert p2.isBlocked(), "p2 is blocked"
            assert ch1.canProcessSend(), "ch1 is ready for sender"
            assert ch2.canProcessSend(), "ch2 is ready for sender"
            {value, channel} = yield from select
              .send [ch1, 42], [ch2, 1337]
              .arbitrate (ops) ->
                return op for op in ops when op.channel is ch2
            assert.equal yes, value
            assert.equal ch2, channel
            yield return 'foo'


        it "selects alternative when no ops are immediately ready", async ->
          ch1 = chan()
          ch2 = chan()

          yield receive proc ->
            {label, value, channel} = yield from select
              .send [ch1, 42]
              .receive ch2
              .else 'label-alternative'
            assert.equal 'label-alternative', label
            assert.equal undefined, value
            assert.equal undefined, channel



      describe "Delegated form:", ->

        it "evaluates inline form", async ->
          ch1 = chan()
          ch2 = chan()
          ch3 = chan()

          p = proc ->
            yield sleep 1
            yield send ch3, 42

          assert.equal 'foo', yield receive proc ->
            yield from select [ch1, 1337], ch2, ch3, (value, channel) ->
              assert.equal 42, value
              assert.equal ch3, channel
              yield return 'foo'

          assert.equal yes, yield receive p


        it "selects receive operation in chained–case form", async ->
          ch1 = chan()
          ch2 = chan()
          ch3 = chan()

          p = proc ->
            yield sleep 1
            yield send ch3, 42

          assert.equal 'foo', yield receive proc ->
            yield from select
              .send [ch1, 1337], (value, channel) ->
                yield return assert no, "unreachable"
              .receive ch2, ch3, (value, channel) ->
                assert.equal 42, value
                assert.equal ch3, channel
                yield return 'foo'

          assert.equal yes, yield receive p


        it "selects send operation in chained–case form", async ->
          ch1 = chan()
          ch2 = chan()
          ch3 = chan()

          p = proc ->
            yield sleep 1
            yield receive ch2

          assert.equal 'foo', yield receive proc ->
            yield from select
              .send [ch1, 42], [ch2, 1337], (value, channel) ->
                assert.equal yes, value
                assert.equal ch2, channel
                yield return 'foo'
              .receive ch3, (value, channel) ->
                yield return assert no, "unreachable"

          assert.equal 1337, yield receive p


        it "arbitrates when multiple ops are immediately ready", async ->
          ch1 = chan()
          ch2 = chan()

          p1 = proc -> yield receive ch1; assert no, "unreachable"
          p2 = proc -> assert.equal 1337, yield receive ch2

          assert.equal 'foo', yield receive proc ->
            assert p1.isBlocked(), "p1 is blocked"
            assert p2.isBlocked(), "p2 is blocked"
            assert ch1.canProcessSend(), "ch1 is ready for sender"
            assert ch2.canProcessSend(), "ch2 is ready for sender"
            yield from select
              .send [ch1, 42], [ch2, 1337], (value, channel) ->
                assert.equal yes, value
                assert.equal ch2, channel
                yield return 'foo'
              .arbitrate (ops) ->
                return op for op in ops when op.channel is ch2


        it "selects alternative when no ops are immediately ready", async ->
          ch1 = chan()
          ch2 = chan()

          assert.equal 'foo', yield receive proc ->
            yield from select
              .send [ch1, 42]
              .receive ch2
              .else -> yield return 'foo'



      describe "Null channels:", ->

        it "discards null/undefined receive ops", async ->
          ch1 = chan()
          ch2 = chan()
          ch3 = chan()

          p1 = proc ->
            {value, channel} = yield from select ch1, null, ch2, null, ch3
            assert.equal value, 42
            assert.equal channel, ch3
          p2 = proc -> yield send ch3, 42
          yield receive p1


        it "discards null/undefined send ops", async ->
          ch1 = chan()
          ch2 = chan()

          p1 = proc ->
            {value, channel} = yield from select
              .send [ch1, 42], [null, 1337], [ch2, 'foo'], [null, 'bar']
            assert.equal value, yes
            assert.equal channel, ch2
          p2 = proc -> yield receive ch2
          yield receive p1



      describe "Cancellation:", ->

        it "frees unselected operations after commit", async ->
          ch1 = chan()
          ch2 = chan()
          ch3 = chan()

          p0 = proc ->
            {value, channel} = yield from select.receive ch1, ch2, ch3
            assert.equal 42, value
            assert.equal ch1, channel
          p1 = proc -> yield receive ch1
          p2 = proc -> yield receive ch2
          p3 = proc -> yield receive ch3

          yield receive proc ->
            assert.equal p0, ch1.head.selector.process
            assert.equal p0, ch2.head.selector.process
            assert.equal p0, ch3.head.selector.process
            assert.equal p1, ch1.tail
            assert.equal p2, ch2.tail
            assert.equal p3, ch3.tail
            yield receive proc -> yield send ch1, 42
            assert.equal p1, ch1.head
            assert.equal p2, ch2.head
            assert.equal p3, ch3.head
            assert.equal p1, ch1.tail
            assert.equal p2, ch2.tail
            assert.equal p3, ch3.tail
            yield return
