    {assert, expect} = require 'chai'

    {proc, chan, send, receive, sleep} = require 'prochan'
    {async} = proc



    describe "Demos:", ->

      it "go ping-pong", async ->
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
