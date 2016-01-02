    {proc, chan, receive, send, final} = require './'
    {Generator} = require './helpers'



    module.exports =


    class Merger
      constructor: (inputs, output) ->
        @width   = inputs.length
        @output  = output ? chan()
        @results = []
        proc new MergeGenerator this, ch for ch in inputs


      class MergeGenerator extends Generator
        constructor: (@merger, @channel) -> super

        next: (value) -> switch ++@_step
          when 1
            return @yield receive @channel
          when 2
            if final()
              @merger.results.push @channel
              if --@merger.width is 0
                @merger.output.close @merger.results
              return @return()
            else
              @_step = 0
              return @yield send @merger.output, value



---

### Notes

Compare `merge` and the manual state machinery of `Merger` as defined here
to the logically equivalent definition that uses generator functions:

> ```coffee
    merge = (inputs, output) ->
      output ?= chan()
      width = inputs.length
      results = []
      for ch in inputs then proc do (ch) ->
        until final value = yield receive ch
          yield send output, value
        results.push ch
        if --width is 0 then output.close results
      output
  ```

* Note use of `do` here to bind iterated `ch` inside the generator function;
  this syntax directly benefits from `proc` accepting either a generator
  function or an already-instantiated generator.
