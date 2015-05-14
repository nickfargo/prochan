// Generated by CoffeeScript 1.9.2
(function() {
  var assert, async, chan, proc, receive, ref, select, send, sleep;

  assert = require('chai').assert;

  ref = require('prochan'), proc = ref.proc, chan = ref.chan, send = ref.send, receive = ref.receive, select = ref.select, sleep = ref.sleep;

  async = proc.async;

  describe("Selector:", function() {
    describe("Scoped form:", function() {
      it("selects from receive operations", async(function*() {
        var ch1, ch2, p1, p2;
        ch1 = chan();
        ch2 = chan();
        p1 = proc(function*() {
          (yield sleep(20));
          return (yield send(ch1, 'foo'));
        });
        p2 = proc(function*() {
          var channel, ref1, value;
          ref1 = (yield* select.receive(ch1, ch2)), value = ref1.value, channel = ref1.channel;
          assert.equal('foo', value);
          assert.equal(ch1, channel);
          return value;
        });
        assert.equal('foo', (yield receive(p2)));
        return assert.equal(true, (yield receive(p1)));
      }));
      it("selects from send operations", async(function*() {
        var ch1, ch2, p1, p2;
        ch1 = chan();
        ch2 = chan();
        p1 = proc(function*() {
          (yield sleep(1));
          return (yield receive(ch1));
        });
        p2 = proc(function*() {
          var channel, ref1, value;
          ref1 = (yield* select.send([ch1, 1337], [ch2, 42])), value = ref1.value, channel = ref1.channel;
          assert.equal(true, value);
          assert.equal(ch1, channel);
          return channel;
        });
        assert.equal(ch1, (yield receive(p2)));
        return assert.equal(1337, (yield receive(p1)));
      }));
      it("selects from mixed receive/send operations", async(function*() {
        var ch1, ch2, p1, p2;
        ch1 = chan();
        ch2 = chan();
        p1 = proc(function*() {
          (yield sleep(1));
          return (yield receive(ch2));
        });
        p2 = proc(function*() {
          var channel, ref1, value;
          ref1 = (yield* select.receive(ch1).send([ch2, 42])), value = ref1.value, channel = ref1.channel;
          assert.equal(true, value);
          assert.equal(ch2, channel);
          return channel;
        });
        assert.equal(ch2, (yield receive(p2)));
        return assert.equal(42, (yield receive(p1)));
      }));
      it("evaluates inline form", async(function*() {
        var ch1, ch2, ch3, p;
        ch1 = chan();
        ch2 = chan();
        ch3 = chan();
        p = proc(function*() {
          (yield sleep(1));
          return (yield send(ch3, 42));
        });
        assert.equal('foo', (yield receive(proc(function*() {
          var channel, ref1, value;
          ref1 = (yield* select([ch1, 1337], ch2, ch3)), value = ref1.value, channel = ref1.channel;
          assert.equal(42, value);
          assert.equal(ch3, channel);
          return 'foo';
        }))));
        return assert.equal(true, (yield receive(p)));
      }));
      it("selects receive operation in chained–case form", async(function*() {
        var ch1, ch2, ch3, p;
        ch1 = chan();
        ch2 = chan();
        ch3 = chan();
        p = proc(function*() {
          (yield sleep(1));
          return (yield send(ch3, 42));
        });
        (yield receive(proc(function*() {
          var channel, ref1, value;
          ref1 = (yield* select.send([ch1, 1337]).receive(ch2, ch3)), value = ref1.value, channel = ref1.channel;
          assert.equal(42, value);
          return assert.equal(ch3, channel);
        })));
        return assert.equal(true, (yield receive(p)));
      }));
      it("selects send operation in chained–case form", async(function*() {
        var ch1, ch2, ch3, p;
        ch1 = chan();
        ch2 = chan();
        ch3 = chan();
        p = proc(function*() {
          (yield sleep(1));
          return (yield receive(ch2));
        });
        (yield receive(proc(function*() {
          var channel, ref1, value;
          ref1 = (yield* select.send([ch1, 42], [ch2, 1337]).receive(ch3)), value = ref1.value, channel = ref1.channel;
          assert.equal(true, value);
          return assert.equal(ch2, channel);
        })));
        return assert.equal(1337, (yield receive(p)));
      }));
      it("arbitrates when multiple ops are immediately ready", async(function*() {
        var ch1, ch2, p1, p2;
        ch1 = chan();
        ch2 = chan();
        p1 = proc(function*() {
          (yield receive(ch1));
          return assert(false, "unreachable");
        });
        p2 = proc(function*() {
          return assert.equal(1337, (yield receive(ch2)));
        });
        return assert.equal('foo', (yield receive(proc(function*() {
          var channel, ref1, value;
          assert(p1.isBlocked(), "p1 is blocked");
          assert(p2.isBlocked(), "p2 is blocked");
          assert(ch1.canProcessSend(), "ch1 is ready for sender");
          assert(ch2.canProcessSend(), "ch2 is ready for sender");
          ref1 = (yield* select.send([ch1, 42], [ch2, 1337]).arbitrate(function(ops) {
            var i, len, op;
            for (i = 0, len = ops.length; i < len; i++) {
              op = ops[i];
              if (op.channel === ch2) {
                return op;
              }
            }
          })), value = ref1.value, channel = ref1.channel;
          assert.equal(true, value);
          assert.equal(ch2, channel);
          return 'foo';
        }))));
      }));
      return it("selects alternative when no ops are immediately ready", async(function*() {
        var ch1, ch2;
        ch1 = chan();
        ch2 = chan();
        return (yield receive(proc(function*() {
          var channel, label, ref1, value;
          ref1 = (yield* select.send([ch1, 42]).receive(ch2)["else"]('label-alternative')), label = ref1.label, value = ref1.value, channel = ref1.channel;
          assert.equal('label-alternative', label);
          assert.equal(void 0, value);
          return assert.equal(void 0, channel);
        })));
      }));
    });
    describe("Delegated form:", function() {
      it("evaluates inline form", async(function*() {
        var ch1, ch2, ch3, p;
        ch1 = chan();
        ch2 = chan();
        ch3 = chan();
        p = proc(function*() {
          (yield sleep(1));
          return (yield send(ch3, 42));
        });
        assert.equal('foo', (yield receive(proc(function*() {
          return (yield* select([ch1, 1337], ch2, ch3, function*(value, channel) {
            assert.equal(42, value);
            assert.equal(ch3, channel);
            return 'foo';
          }));
        }))));
        return assert.equal(true, (yield receive(p)));
      }));
      it("selects receive operation in chained–case form", async(function*() {
        var ch1, ch2, ch3, p;
        ch1 = chan();
        ch2 = chan();
        ch3 = chan();
        p = proc(function*() {
          (yield sleep(1));
          return (yield send(ch3, 42));
        });
        assert.equal('foo', (yield receive(proc(function*() {
          return (yield* select.send([ch1, 1337], function*(value, channel) {
            return assert(false, "unreachable");
          }).receive(ch2, ch3, function*(value, channel) {
            assert.equal(42, value);
            assert.equal(ch3, channel);
            return 'foo';
          }));
        }))));
        return assert.equal(true, (yield receive(p)));
      }));
      it("selects send operation in chained–case form", async(function*() {
        var ch1, ch2, ch3, p;
        ch1 = chan();
        ch2 = chan();
        ch3 = chan();
        p = proc(function*() {
          (yield sleep(1));
          return (yield receive(ch2));
        });
        assert.equal('foo', (yield receive(proc(function*() {
          return (yield* select.send([ch1, 42], [ch2, 1337], function*(value, channel) {
            assert.equal(true, value);
            assert.equal(ch2, channel);
            return 'foo';
          }).receive(ch3, function*(value, channel) {
            return assert(false, "unreachable");
          }));
        }))));
        return assert.equal(1337, (yield receive(p)));
      }));
      it("arbitrates when multiple ops are immediately ready", async(function*() {
        var ch1, ch2, p1, p2;
        ch1 = chan();
        ch2 = chan();
        p1 = proc(function*() {
          (yield receive(ch1));
          return assert(false, "unreachable");
        });
        p2 = proc(function*() {
          return assert.equal(1337, (yield receive(ch2)));
        });
        return assert.equal('foo', (yield receive(proc(function*() {
          assert(p1.isBlocked(), "p1 is blocked");
          assert(p2.isBlocked(), "p2 is blocked");
          assert(ch1.canProcessSend(), "ch1 is ready for sender");
          assert(ch2.canProcessSend(), "ch2 is ready for sender");
          return (yield* select.send([ch1, 42], [ch2, 1337], function*(value, channel) {
            assert.equal(true, value);
            assert.equal(ch2, channel);
            return 'foo';
          }).arbitrate(function(ops) {
            var i, len, op;
            for (i = 0, len = ops.length; i < len; i++) {
              op = ops[i];
              if (op.channel === ch2) {
                return op;
              }
            }
          }));
        }))));
      }));
      return it("selects alternative when no ops are immediately ready", async(function*() {
        var ch1, ch2;
        ch1 = chan();
        ch2 = chan();
        return assert.equal('foo', (yield receive(proc(function*() {
          return (yield* select.send([ch1, 42]).receive(ch2)["else"](function*() {
            return 'foo';
          }));
        }))));
      }));
    });
    return describe("Cancellation:", function() {
      return it("frees unselected operations after commit", async(function*() {
        var ch1, ch2, ch3, p0, p1, p2, p3;
        ch1 = chan();
        ch2 = chan();
        ch3 = chan();
        p0 = proc(function*() {
          var channel, ref1, value;
          ref1 = (yield* select.receive(ch1, ch2, ch3)), value = ref1.value, channel = ref1.channel;
          assert.equal(42, value);
          return assert.equal(ch1, channel);
        });
        p1 = proc(function*() {
          return (yield receive(ch1));
        });
        p2 = proc(function*() {
          return (yield receive(ch2));
        });
        p3 = proc(function*() {
          return (yield receive(ch3));
        });
        return (yield receive(proc(function*() {
          assert.equal(p0, ch1.head.selector.process);
          assert.equal(p0, ch2.head.selector.process);
          assert.equal(p0, ch3.head.selector.process);
          assert.equal(p1, ch1.tail);
          assert.equal(p2, ch2.tail);
          assert.equal(p3, ch3.tail);
          (yield receive(proc(function*() {
            return (yield send(ch1, 42));
          })));
          assert.equal(p1, ch1.head);
          assert.equal(p2, ch2.head);
          assert.equal(p3, ch3.head);
          assert.equal(p1, ch1.tail);
          assert.equal(p2, ch2.tail);
          assert.equal(p3, ch3.tail);
          return;
        })));
      }));
    });
  });

}).call(this);
