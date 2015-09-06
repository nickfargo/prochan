    {assert} = require 'chai'
    {proc, chan, send, receive, final, merge} = require 'prochan'
    {async} = proc



    describe "Merge:", ->

      it "merges", async ->

        p1 = proc ->
          yield send 1
          yield send 2
          yield send 3
          yield send 4
          'foo'

        p2 = proc ->
          yield send 5
          yield send 6
          yield send 7
          'bar'

        p3 = proc ->
          yield send 8
          yield send 9
          'baz'

        merged = merge [p1, p2, p3]

        values = yield receive proc ->
          until final value = yield receive merged
            value
        results =
          for ch in yield receive merged
            yield receive ch

        # Order of merged output is not defined
        assert.equal values.length, 9
        assert.equal results.length, 3
