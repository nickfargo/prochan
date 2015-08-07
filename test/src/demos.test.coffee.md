    {assert, expect} = require 'chai'

    {proc, chan, send, receive, final, sleep} = require 'prochan'
    {async} = proc



    describe "Demos:", ->

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


      it "detects `done` without racing or sentinels", async ->
        sanity = 10
        producer = proc ->
          yield send i for i in [1..10]
          'foo'
        consumers = for i in [1..3] then proc ->
          until final value = yield receive producer
            if sanity-- is 0 then throw new Error "Insanity"
          value
        for c in consumers then assert.equal 'foo', yield receive c
