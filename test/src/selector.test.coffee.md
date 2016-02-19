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
            {value, channel} = yield select.receive ch1, ch2
            assert.equal value, 'foo'
            assert.equal channel, ch1
            value

          assert.equal yield p2, 'foo'
          assert.equal yield p1, yes


        it "selects from send operations", async ->
          ch1 = chan()
          ch2 = chan()

          p1 = proc ->
            yield sleep 1
            yield ch1

          p2 = proc ->
            {value, channel} = yield select.send [ch1, 1337], [ch2, 42]
            assert.equal yes, value
            assert.equal ch1, channel
            channel

          assert.equal yield p2, ch1
          assert.equal yield p1, 1337


        it "selects from mixed receive/send operations", async ->
          ch1 = chan()
          ch2 = chan()

          p1 = proc ->
            yield sleep 1
            yield ch2

          p2 = proc ->
            {value, channel} = yield select
              .receive ch1
              .send [ch2, 42]
            assert.equal yes, value
            assert.equal ch2, channel
            channel

          assert.equal yield p2, ch2
          assert.equal yield p1, 42


        it "evaluates inline form", async ->
          ch1 = chan()
          ch2 = chan()
          ch3 = chan()

          p = proc ->
            yield sleep 1
            yield send ch3, 42

          assert.equal 'foo', yield proc ->
            {value, channel} = yield select [ch1, 1337], ch2, ch3
            assert.equal 42, value
            assert.equal ch3, channel
            'foo'

          assert.equal yield p, yes


        it "selects receive operation in chained–case form", async ->
          ch1 = chan()
          ch2 = chan()
          ch3 = chan()

          p = proc ->
            yield sleep 1
            yield send ch3, 42

          yield proc ->
            {value, channel} = yield select
              .send [ch1, 1337]
              .receive ch2, ch3
            assert.equal value, 42
            assert.equal channel, ch3

          assert.equal yield p, yes


        it "selects send operation in chained–case form", async ->
          ch1 = chan()
          ch2 = chan()
          ch3 = chan()

          p = proc ->
            yield sleep 1
            yield ch2

          yield proc ->
            {value, channel} = yield select
              .send [ch1, 42], [ch2, 1337]
              .receive ch3
            assert.equal value, yes
            assert.equal channel, ch2

          assert.equal yield p, 1337


        it "arbitrates when multiple ops are immediately ready", async ->
          ch1 = chan()
          ch2 = chan()

          p1 = proc -> yield ch1; assert no, "unreachable"
          p2 = proc -> assert.equal yield ch2, 1337

          assert.equal 'foo', yield proc ->
            assert p1.isBlocked(), "p1 is blocked"
            assert p2.isBlocked(), "p2 is blocked"
            assert ch1.canProcessSend(), "ch1 is ready for sender"
            assert ch2.canProcessSend(), "ch2 is ready for sender"
            {value, channel} = yield select
              .send [ch1, 42], [ch2, 1337]
              .arbitrate (ops) ->
                return op for op in ops when op.channel is ch2
            assert.equal value, yes
            assert.equal channel, ch2
            yield return 'foo'


        it "selects alternative when no ops are immediately ready", async ->
          ch1 = chan()
          ch2 = chan()

          yield proc ->
            {label, value, channel} = yield select
              .send [ch1, 42]
              .receive ch2
              .else 'label-alternative'
            assert.equal label, 'label-alternative'
            assert.equal value, undefined
            assert.equal channel, null



      describe "Delegated form:", ->

        it "evaluates inline form", async ->
          ch1 = chan()
          ch2 = chan()
          ch3 = chan()

          p1 = proc ->
            yield sleep 1
            yield send ch3, 42

          p2 = proc ->
            yield from select [ch1, 1337], ch2, ch3, (value, channel) ->
              assert.equal value, 42
              assert.equal channel, ch3
              yield return 'foo'

          assert.equal yield p1, yes
          assert.equal yield p2, 'foo'


        it "selects receive operation in chained–case form", async ->
          ch1 = chan()
          ch2 = chan()
          ch3 = chan()

          p1 = proc ->
            yield sleep 1
            yield send ch3, 42

          p2 = proc ->
            yield from select
              .send [ch1, 1337], (value, channel) ->
                yield return assert no, "unreachable"
              .receive ch2, ch3, (value, channel) ->
                assert.equal value, 42
                assert.equal channel, ch3
                yield return 'foo'

          assert.equal yield p1, yes
          assert.equal yield p2, 'foo'


        it "selects send operation in chained–case form", async ->
          ch1 = chan()
          ch2 = chan()
          ch3 = chan()

          p1 = proc ->
            yield sleep 1
            yield ch2

          p2 = proc ->
            yield from select
              .send [ch1, 42], [ch2, 1337], (value, channel) ->
                assert.equal value, yes
                assert.equal channel, ch2
                yield return 'foo'
              .receive ch3, (value, channel) ->
                yield return assert no, "unreachable"

          assert.equal yield p1, 1337
          assert.equal yield p2, 'foo'


        it "arbitrates when multiple ops are immediately ready", async ->
          ch1 = chan()
          ch2 = chan()

          p1 = proc -> yield ch1; assert no, "unreachable"
          p2 = proc -> assert.equal yield ch2, 1337

          p3 = proc ->
            assert p1.isBlocked(), "p1 is blocked"
            assert p2.isBlocked(), "p2 is blocked"
            assert ch1.canProcessSend(), "ch1 is ready for sender"
            assert ch2.canProcessSend(), "ch2 is ready for sender"
            yield from select
              .send [ch1, 42], [ch2, 1337], (value, channel) ->
                assert.equal value, yes
                assert.equal channel, ch2
                yield return 'foo'
              .arbitrate (ops) ->
                return op for op in ops when op.channel is ch2

          assert.equal yield p3, 'foo'


        it "selects alternative when no ops are immediately ready", async ->
          ch1 = chan()
          ch2 = chan()

          assert.equal 'foo', yield proc ->
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
            {value, channel} = yield select ch1, null, ch2, null, ch3
            assert.equal value, 42
            assert.equal channel, ch3
          p2 = proc -> yield send ch3, 42
          yield p1


        it "discards null/undefined send ops", async ->
          ch1 = chan()
          ch2 = chan()

          p1 = proc ->
            {value, channel} = yield select
              .send [ch1, 42], [null, 1337], [ch2, 'foo'], [null, 'bar']
            assert.equal value, yes
            assert.equal channel, ch2
          p2 = proc -> yield ch2
          yield p1



      describe "Cancellation:", ->

        it "frees unselected operations after commit", async ->
          ch1 = chan()
          ch2 = chan()
          ch3 = chan()

          p0 = proc ->
            {value, channel} = yield select ch1, ch2, ch3
            assert.equal value, 42
            assert.equal channel, ch1
          p1 = proc -> yield ch1
          p2 = proc -> yield ch2
          p3 = proc -> yield ch3

          yield proc ->
            assert.equal p0, ch1.head.selector.process
            assert.equal p0, ch2.head.selector.process
            assert.equal p0, ch3.head.selector.process
            assert.equal p1, ch1.tail
            assert.equal p2, ch2.tail
            assert.equal p3, ch3.tail
            yield proc -> yield send ch1, 42
            assert.equal p1, ch1.head
            assert.equal p2, ch2.head
            assert.equal p3, ch3.head
            assert.equal p1, ch1.tail
            assert.equal p2, ch2.tail
            assert.equal p3, ch3.tail
            yield return
