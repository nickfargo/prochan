    {assert, expect} = require 'chai'

    {proc, go, chan, send, receive, final, select, sleep} = require 'prochan'
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



### chan.from

    describe "chan.from", ->

      it "correctly loads small arrays", ->
        ch = chan.from [1..10]
        assert.equal ch.buffer.queue.length, 10

      it "correctly loads multi-cell size arrays", ->
        ch = chan.from [1..72]
        q = ch.buffer.queue
        assert q?
        assert.equal q.head._next._next, q.tail
        assert.equal q.tail._prev._prev, q.head
        assert.equal q.tail.array.length, 8



### Laziness

Channel operations `receive` and `send` are performed **eagerly**, i.e., for
the current process, each application of the `run` loop greedily performs as
many yielding operations as possible, and will break only after encountering a
channel that causes the process to `block`.

Alternatively a process may be run **lazily**, by including the `yield null`
expression, which forces control to be yielded back to the scheduler, and
re-enqueues the process at the back of the global run queue.

This may be useful, for example, within long-running loop structures, so as to
cooperatively avoid causing starvation of other scheduled processes.

    describe "Laziness:", ->

      it "allows eager-to-lazy communication", async ->

        nibble = go ->
          src = chan.from [1..3]
          yield proc ->
            for i in [1..3]
              value = yield src
              yield null
              value

        gobble = go ->
          src = chan.from [1..9]
          yield proc ->
            for i in [1..9] then yield src

The first process to finish should be `gobble`, even though `nibble` performs
fewer operations, because the receiving subprocess of `nibble` is lazy.

        {value, channel} = yield from select nibble, gobble
        assert.equal channel, gobble
