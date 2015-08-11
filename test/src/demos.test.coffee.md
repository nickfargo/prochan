    {assert, expect} = require 'chai'

    {proc, chan, send, receive, final, sleep} = require 'prochan'
    {async} = proc



    describe "Demos:", ->


#### Ping pong

      it "does go ping-pong", async ->
        table = chan()

        Ball = -> @hits = 0

        player = (name, table) -> loop
          ball = yield receive table
          ball.hits++
          # console.log "#{ball.hits}: #{name}"
          yield sleep 1
          yield send table, ball

        proc player 'Ping ->', table
        proc player '<- Pong', table

        yield send table, ball = new Ball       # put a ball on the table
        yield sleep 20                          # wait while players play
        assert.equal ball, yield receive table  # take ball off the table


#### Prime sieve

A `sieve` builds a chain of processes, beginning with a `source` process that
outputs the numbers > 1. For each `prime` number received from `source`, a new
`filtering` process that removes multiples of that `prime` is added to the end
of the chain, and this process becomes the new `source`.

      it "sieves the primes", async ->

        numbers = (start) ->
          n = start; loop then yield send n++
          return

        filtering = (input, prime) ->
          loop
            n = yield receive input
            yield send n if n % prime
          return

        sieve = ->
          source = proc numbers 2
          loop
            yield send prime = yield receive source
            source = proc filtering source, prime
          return

        primes = proc sieve
        yielded = (n until 50 < n = yield receive primes)
        assert.deepEqual yielded, [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47]


#### The `final` countdown

This test uses the `final` function to safely detect whether a `receive`
operation takes place on a channel that is **done**.

Even though `final(x)` appears to apply `final` to `x`, in fact this is just a
syntactical ~~trick~~ illusion, as `final` is concerned only with the timing of
its evaluation relative to that of `x`. Thus the expressions `final(x)` and
`(x, final())` are equivalent in both value and effect.

      it "detects `done` without racing or sentinels", async ->
        sanity = 10
        producer = proc ->
          yield send i for i in [1..10]
          'foo'
        consumers = for i in [1..3] then proc ->
          until final value = yield receive producer
            if sanity-- is 0 then throw new Error "Huge mistake"
          value
        for c in consumers then assert.equal 'foo', yield receive c
