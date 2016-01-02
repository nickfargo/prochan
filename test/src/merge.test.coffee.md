    {assert} = require 'chai'
    {proc, chan, send, receive, final, merge} = require 'prochan'
    {async} = proc



    describe "Merge:", ->

      it "merges values into single output channel", async ->

        inputs = [
          proc ->
            yield send 1
            yield send 2
            yield send 3
            yield send 4
            yield send 5
            'foo'

          proc ->
            yield send 6
            yield send 7
            yield send 8
            'bar'

          proc ->
            yield send 9
            'baz'
        ]

        merged = merge inputs

        values = yield receive proc ->
          until final value = yield receive merged
            value
        assert.sameMembers   values, [1..9]
        assert.notDeepEqual  values, [1..9]

        mergedResult = yield receive merged
        assert.sameMembers   inputs, mergedResult
        assert.notDeepEqual  inputs, mergedResult

        resultValues =
          for ch in mergedResult
            yield receive ch
        assert.sameMembers   resultValues, ['foo', 'bar', 'baz']
        assert.notDeepEqual  resultValues, ['foo', 'bar', 'baz']
