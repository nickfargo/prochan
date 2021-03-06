// Generated by CoffeeScript 1.10.0
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
          ref1 = (yield select.receive(ch1, ch2)), value = ref1.value, channel = ref1.channel;
          assert.equal(value, 'foo');
          assert.equal(channel, ch1);
          return value;
        });
        assert.equal((yield p2), 'foo');
        return assert.equal((yield p1), true);
      }));
      it("selects from send operations", async(function*() {
        var ch1, ch2, p1, p2;
        ch1 = chan();
        ch2 = chan();
        p1 = proc(function*() {
          (yield sleep(1));
          return (yield ch1);
        });
        p2 = proc(function*() {
          var channel, ref1, value;
          ref1 = (yield select.send([ch1, 1337], [ch2, 42])), value = ref1.value, channel = ref1.channel;
          assert.equal(true, value);
          assert.equal(ch1, channel);
          return channel;
        });
        assert.equal((yield p2), ch1);
        return assert.equal((yield p1), 1337);
      }));
      it("selects from mixed receive/send operations", async(function*() {
        var ch1, ch2, p1, p2;
        ch1 = chan();
        ch2 = chan();
        p1 = proc(function*() {
          (yield sleep(1));
          return (yield ch2);
        });
        p2 = proc(function*() {
          var channel, ref1, value;
          ref1 = (yield select.receive(ch1).send([ch2, 42])), value = ref1.value, channel = ref1.channel;
          assert.equal(true, value);
          assert.equal(ch2, channel);
          return channel;
        });
        assert.equal((yield p2), ch2);
        return assert.equal((yield p1), 42);
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
        assert.equal('foo', (yield proc(function*() {
          var channel, ref1, value;
          ref1 = (yield select([ch1, 1337], ch2, ch3)), value = ref1.value, channel = ref1.channel;
          assert.equal(42, value);
          assert.equal(ch3, channel);
          return 'foo';
        })));
        return assert.equal((yield p), true);
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
        (yield proc(function*() {
          var channel, ref1, value;
          ref1 = (yield select.send([ch1, 1337]).receive(ch2, ch3)), value = ref1.value, channel = ref1.channel;
          assert.equal(value, 42);
          return assert.equal(channel, ch3);
        }));
        return assert.equal((yield p), true);
      }));
      it("selects send operation in chained–case form", async(function*() {
        var ch1, ch2, ch3, p;
        ch1 = chan();
        ch2 = chan();
        ch3 = chan();
        p = proc(function*() {
          (yield sleep(1));
          return (yield ch2);
        });
        (yield proc(function*() {
          var channel, ref1, value;
          ref1 = (yield select.send([ch1, 42], [ch2, 1337]).receive(ch3)), value = ref1.value, channel = ref1.channel;
          assert.equal(value, true);
          return assert.equal(channel, ch2);
        }));
        return assert.equal((yield p), 1337);
      }));
      it("arbitrates when multiple ops are immediately ready", async(function*() {
        var ch1, ch2, p1, p2;
        ch1 = chan();
        ch2 = chan();
        p1 = proc(function*() {
          (yield ch1);
          return assert(false, "unreachable");
        });
        p2 = proc(function*() {
          return assert.equal((yield ch2), 1337);
        });
        return assert.equal('foo', (yield proc(function*() {
          var channel, ref1, value;
          assert(p1.isBlocked(), "p1 is blocked");
          assert(p2.isBlocked(), "p2 is blocked");
          assert(ch1.canProcessSend(), "ch1 is ready for sender");
          assert(ch2.canProcessSend(), "ch2 is ready for sender");
          ref1 = (yield select.send([ch1, 42], [ch2, 1337]).arbitrate(function(ops) {
            var i, len, op;
            for (i = 0, len = ops.length; i < len; i++) {
              op = ops[i];
              if (op.channel === ch2) {
                return op;
              }
            }
          })), value = ref1.value, channel = ref1.channel;
          assert.equal(value, true);
          assert.equal(channel, ch2);
          return 'foo';
        })));
      }));
      return it("selects alternative when no ops are immediately ready", async(function*() {
        var ch1, ch2;
        ch1 = chan();
        ch2 = chan();
        return (yield proc(function*() {
          var channel, label, ref1, value;
          ref1 = (yield select.send([ch1, 42]).receive(ch2)["else"]('label-alternative')), label = ref1.label, value = ref1.value, channel = ref1.channel;
          assert.equal(label, 'label-alternative');
          assert.equal(value, void 0);
          return assert.equal(channel, null);
        }));
      }));
    });
    describe("Delegated form:", function() {
      it("evaluates inline form", async(function*() {
        var ch1, ch2, ch3, p1, p2;
        ch1 = chan();
        ch2 = chan();
        ch3 = chan();
        p1 = proc(function*() {
          (yield sleep(1));
          return (yield send(ch3, 42));
        });
        p2 = proc(function*() {
          return (yield* select([ch1, 1337], ch2, ch3, function*(value, channel) {
            assert.equal(value, 42);
            assert.equal(channel, ch3);
            return 'foo';
          }));
        });
        assert.equal((yield p1), true);
        return assert.equal((yield p2), 'foo');
      }));
      it("selects receive operation in chained–case form", async(function*() {
        var ch1, ch2, ch3, p1, p2;
        ch1 = chan();
        ch2 = chan();
        ch3 = chan();
        p1 = proc(function*() {
          (yield sleep(1));
          return (yield send(ch3, 42));
        });
        p2 = proc(function*() {
          return (yield* select.send([ch1, 1337], function*(value, channel) {
            return assert(false, "unreachable");
          }).receive(ch2, ch3, function*(value, channel) {
            assert.equal(value, 42);
            assert.equal(channel, ch3);
            return 'foo';
          }));
        });
        assert.equal((yield p1), true);
        return assert.equal((yield p2), 'foo');
      }));
      it("selects send operation in chained–case form", async(function*() {
        var ch1, ch2, ch3, p1, p2;
        ch1 = chan();
        ch2 = chan();
        ch3 = chan();
        p1 = proc(function*() {
          (yield sleep(1));
          return (yield ch2);
        });
        p2 = proc(function*() {
          return (yield* select.send([ch1, 42], [ch2, 1337], function*(value, channel) {
            assert.equal(value, true);
            assert.equal(channel, ch2);
            return 'foo';
          }).receive(ch3, function*(value, channel) {
            return assert(false, "unreachable");
          }));
        });
        assert.equal((yield p1), 1337);
        return assert.equal((yield p2), 'foo');
      }));
      it("arbitrates when multiple ops are immediately ready", async(function*() {
        var ch1, ch2, p1, p2, p3;
        ch1 = chan();
        ch2 = chan();
        p1 = proc(function*() {
          (yield ch1);
          return assert(false, "unreachable");
        });
        p2 = proc(function*() {
          return assert.equal((yield ch2), 1337);
        });
        p3 = proc(function*() {
          assert(p1.isBlocked(), "p1 is blocked");
          assert(p2.isBlocked(), "p2 is blocked");
          assert(ch1.canProcessSend(), "ch1 is ready for sender");
          assert(ch2.canProcessSend(), "ch2 is ready for sender");
          return (yield* select.send([ch1, 42], [ch2, 1337], function*(value, channel) {
            assert.equal(value, true);
            assert.equal(channel, ch2);
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
        });
        return assert.equal((yield p3), 'foo');
      }));
      return it("selects alternative when no ops are immediately ready", async(function*() {
        var ch1, ch2;
        ch1 = chan();
        ch2 = chan();
        return assert.equal('foo', (yield proc(function*() {
          return (yield* select.send([ch1, 42]).receive(ch2)["else"](function*() {
            return 'foo';
          }));
        })));
      }));
    });
    describe("Null channels:", function() {
      it("discards null/undefined receive ops", async(function*() {
        var ch1, ch2, ch3, p1, p2;
        ch1 = chan();
        ch2 = chan();
        ch3 = chan();
        p1 = proc(function*() {
          var channel, ref1, value;
          ref1 = (yield select(ch1, null, ch2, null, ch3)), value = ref1.value, channel = ref1.channel;
          assert.equal(value, 42);
          return assert.equal(channel, ch3);
        });
        p2 = proc(function*() {
          return (yield send(ch3, 42));
        });
        return (yield p1);
      }));
      return it("discards null/undefined send ops", async(function*() {
        var ch1, ch2, p1, p2;
        ch1 = chan();
        ch2 = chan();
        p1 = proc(function*() {
          var channel, ref1, value;
          ref1 = (yield select.send([ch1, 42], [null, 1337], [ch2, 'foo'], [null, 'bar'])), value = ref1.value, channel = ref1.channel;
          assert.equal(value, true);
          return assert.equal(channel, ch2);
        });
        p2 = proc(function*() {
          return (yield ch2);
        });
        return (yield p1);
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
          ref1 = (yield select(ch1, ch2, ch3)), value = ref1.value, channel = ref1.channel;
          assert.equal(value, 42);
          return assert.equal(channel, ch1);
        });
        p1 = proc(function*() {
          return (yield ch1);
        });
        p2 = proc(function*() {
          return (yield ch2);
        });
        p3 = proc(function*() {
          return (yield ch3);
        });
        return (yield proc(function*() {
          assert.equal(p0, ch1.head.selector.process);
          assert.equal(p0, ch2.head.selector.process);
          assert.equal(p0, ch3.head.selector.process);
          assert.equal(p1, ch1.tail);
          assert.equal(p2, ch2.tail);
          assert.equal(p3, ch3.tail);
          (yield proc(function*() {
            return (yield send(ch1, 42));
          }));
          assert.equal(p1, ch1.head);
          assert.equal(p2, ch2.head);
          assert.equal(p3, ch3.head);
          assert.equal(p1, ch1.tail);
          assert.equal(p2, ch2.tail);
          assert.equal(p3, ch3.tail);
          return;
        }));
      }));
    });
  });

}).call(this);
