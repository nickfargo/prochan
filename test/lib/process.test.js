// Generated by CoffeeScript 1.9.3
(function() {
  var assert, async, chan, comp, filter, map, mapcat, offer, poll, proc, receive, ref, ref1, send, takeWhile;

  assert = require('chai').assert;

  ref = require('prochan'), proc = ref.proc, chan = ref.chan, send = ref.send, receive = ref.receive, poll = ref.poll, offer = ref.offer;

  async = proc.async;

  ref1 = require('transducers-js'), comp = ref1.comp, map = ref1.map, filter = ref1.filter, mapcat = ref1.mapcat, takeWhile = ref1.takeWhile;

  describe("Process:", function() {
    return describe("I/O:", function() {
      return it("lets pass-through process act as a logical channel", async(function*() {
        var p1, p2, p3, p4, p5, p6, p7, p8, p9, pc;
        pc = proc(function*() {
          var value;
          while (true) {
            value = (yield receive());
            if (proc.isClosed()) {
              return value;
            } else {
              (yield send(value));
            }
          }
        });
        p1 = proc(function*() {
          return assert.equal(42, (yield receive(pc)));
        });
        p2 = proc(function*() {
          return (yield send(pc, 42));
        });
        (yield receive(p1));
        p3 = proc(function*() {
          return (yield send(pc, 42));
        });
        p4 = proc(function*() {
          return assert.equal(42, (yield receive(pc)));
        });
        (yield receive(p4));
        p5 = proc(function*() {
          return assert.equal(true, (yield send(pc, 42)));
        });
        p6 = proc(function*() {
          return (yield receive(pc));
        });
        (yield receive(p6));
        p7 = proc(function*() {
          return (yield receive(pc));
        });
        p8 = proc(function*() {
          return assert.equal(true, (yield send(pc, 42)));
        });
        (yield receive(p7));
        pc["in"]().close(1337);
        p9 = proc(function*() {
          return assert.equal(1337, (yield receive(pc)));
        });
        (yield receive(p9));
        assert.equal(true, pc.isClosed());
        return assert.equal(true, pc.isDone());
      }));
    });
  });

}).call(this);
