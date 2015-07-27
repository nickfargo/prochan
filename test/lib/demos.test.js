// Generated by CoffeeScript 1.9.2
(function() {
  var assert, async, chan, expect, final, proc, receive, ref, ref1, send, sleep;

  ref = require('chai'), assert = ref.assert, expect = ref.expect;

  ref1 = require('prochan'), proc = ref1.proc, chan = ref1.chan, send = ref1.send, receive = ref1.receive, final = ref1.final, sleep = ref1.sleep;

  async = proc.async;

  describe("Demos:", function() {
    it("go ping-pong", async(function*() {
      var Ball, ball, player, table;
      table = chan();
      Ball = function() {
        return this.hits = 0;
      };
      player = function*(name, table) {
        var ball, results;
        results = [];
        while (true) {
          ball = (yield receive(table));
          ball.hits++;
          (yield sleep(1));
          results.push((yield send(table, ball)));
        }
        return results;
      };
      proc(player('Ping ->', table));
      proc(player('<- Pong', table));
      (yield send(table, ball = new Ball));
      (yield sleep(20));
      return assert.equal(ball, (yield receive(table)));
    }));
    return it("can do race-free `done` detection", async(function*() {
      var p, sanity;
      sanity = 12;
      p = proc(function*() {
        var i, j;
        for (i = j = 1; j <= 10; i = ++j) {
          (yield send(i));
        }
        return 'foo';
      });
      return assert.equal('foo', (yield receive(proc(function*() {
        var value;
        while (true) {
          if (final(value = (yield receive(p)))) {
            return value;
          } else if (--sanity < 0) {
            throw new Error("Insanity");
          }
        }
      }))));
    }));
  });

}).call(this);
