    {assert} = require 'chai'

    {proc, chan, send, final, select, sleep} = require 'prochan'
    {async} = proc



    describe "Demos:", ->


#### Ping pong

      it "does go ping-pong", async ->
        table = chan()

        Ball = -> @hits = 0

        player = (name, table) -> loop
          ball = yield table
          ball.hits++
          # console.log "#{ball.hits}: #{name}"
          yield sleep 1
          yield send table, ball

        proc player 'Ping ->', table
        proc player '<- Pong', table

        yield send table, ball = new Ball  # put a ball on the table
        yield sleep 20                     # wait while players play
        assert.equal ball, yield table     # take ball off the table


#### Prime sieve

A `sieve` yields the sequence of prime numbers by building a process chain,
starting with a `source` process that outputs the sequence of all numbers > 1.
As each `prime` number is received from `source` and piped to output, a
`filtering` process that removes multiples of that `prime` is added to the end
of the chain, and this process becomes the new `source`. Thus, by passing the
number sequence through this growing series of filters, the process referenced
by `source` will always yield the next prime number.

      it "sieves the primes", async ->

        numbers = (start) ->
          n = start; loop then yield send n++
          return

        filtering = (input, prime) ->
          loop
            n = yield input
            yield send n if n % prime
          return

        sieve = ->
          source = proc numbers 2
          loop
            yield send prime = yield source
            source = proc filtering source, prime
          return

        primes = proc sieve
        for n in [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47]
          assert.equal n, yield primes
        return


#### The `final` countdown

Multiple competing consumers use the `final` function to safely detect whether
a `receive` operation takes place on a channel that is **done**.

Even though the form `final(x)` used here appears to apply `final` to `x`, in
fact this is just a convenient syntactical ~~trick~~ illusion: `final` actually
ignores its arguments, and is concerned only with the timing of its evaluation
relative to that of `x`. Thus the expressions `final(x)` and `(x, final())` are
equivalent, in both value and effect.

      it "detects `done` without racing or sentinels", async ->
        sanity = 10

        producer = proc ->
          yield send i for i in [1..10]
          'foo'

        consumers = for i in [1..3] then proc ->
          until final value = yield producer
            if sanity-- is 0 then throw new Error "Huge mistake"
          value

        for c in consumers
          assert.equal 'foo', yield c
        return
