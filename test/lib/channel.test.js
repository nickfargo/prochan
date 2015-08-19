// Generated by CoffeeScript 1.9.3
(function() {
  var assert, async, chan, comp, filter, map, mapcat, offer, poll, proc, receive, ref, ref1, send, sleep, takeWhile;

  assert = require('chai').assert;

  ref = require('prochan'), proc = ref.proc, chan = ref.chan, send = ref.send, receive = ref.receive, poll = ref.poll, offer = ref.offer, sleep = ref.sleep;

  async = proc.async;

  ref1 = require('transducers-js'), comp = ref1.comp, map = ref1.map, filter = ref1.filter, mapcat = ref1.mapcat, takeWhile = ref1.takeWhile;

  describe("Channel:", function() {
    describe("construction:", function() {
      it("creates unbuffered", function() {
        var ch;
        ch = chan();
        assert.equal(ch.constructor.name, 'Channel');
        return assert(ch.buffer == null);
      });
      it("creates zero-buffered", function() {
        var ch;
        ch = chan(0);
        assert(ch.buffer != null);
        return assert.equal(ch.buffer.size, 0);
      });
      it("creates fixed buffered", function() {
        var ch;
        ch = chan(42);
        assert(ch.buffer != null);
        return assert.equal(ch.buffer.size, 42);
      });
      it("creates dropping buffered", function() {
        var ch;
        ch = chan.dropping(42);
        assert(ch.buffer != null);
        return assert.equal(ch.buffer.size, 42);
      });
      return it("creates sliding buffered", function() {
        var ch;
        ch = chan.sliding(42);
        assert(ch.buffer != null);
        return assert.equal(ch.buffer.size, 42);
      });
    });
    describe("receiving:", function() {
      it("yields correctly on blocking receive", async(function*() {
        var ch, p1, p2;
        ch = chan();
        p1 = proc(function*() {
          var opResult;
          assert.equal(void 0, opResult = receive(ch));
          return assert.equal(42, (yield opResult));
        });
        p2 = proc(function*() {
          return (yield send(ch, 42));
        });
        return (yield receive(p1));
      }));
      it("yields correctly on immediate receive", async(function*() {
        var ch, p1, p2;
        ch = chan();
        p1 = proc(function*() {
          return (yield send(ch, 42));
        });
        p2 = proc(function*() {
          var opResult;
          assert.equal(42, opResult = receive(ch));
          return assert.equal(42, (yield opResult));
        });
        return (yield receive(p2));
      }));
      it("yields correctly on blocking receive before done", async(function*() {
        var ch, p1, p2;
        ch = chan();
        p1 = proc(function*() {
          var opResult;
          assert.equal(void 0, opResult = receive(ch));
          return assert.equal(42, (yield opResult));
        });
        p2 = proc(function*() {
          return (yield ch.close(42));
        });
        return (yield receive(p1));
      }));
      return it("yields correctly on immediate receive after done", async(function*() {
        var ch, p1, p2;
        ch = chan();
        p1 = proc(function*() {
          return (yield ch.close(42));
        });
        p2 = proc(function*() {
          var opResult;
          assert.equal(42, opResult = receive(ch));
          return assert.equal(42, (yield opResult));
        });
        return (yield receive(p2));
      }));
    });
    describe("sending:", function() {
      it("yields correctly on blocking send", async(function*() {
        var ch, p1, p2;
        ch = chan();
        p1 = proc(function*() {
          var opResult;
          assert.equal(false, opResult = send(ch, 42));
          return assert.equal(true, (yield opResult));
        });
        p2 = proc(function*() {
          return (yield receive(ch));
        });
        return (yield receive(p2));
      }));
      it("yields correctly on immediate send", async(function*() {
        var ch, p1, p2;
        ch = chan();
        p1 = proc(function*() {
          return (yield receive(ch));
        });
        p2 = proc(function*() {
          var opResult;
          assert.equal(true, opResult = send(ch, 42));
          return assert.equal(true, (yield opResult));
        });
        return (yield receive(p1));
      }));
      it("yields correctly on blocking send before close", async(function*() {
        var ch, p1, p2;
        ch = chan();
        p1 = proc(function*() {
          var opResult;
          assert.equal(false, opResult = send(ch, 42));
          return assert.equal(false, (yield opResult));
        });
        p2 = proc(function*() {
          return (yield ch.close());
        });
        return (yield receive(p2));
      }));
      return it("yields correctly on immediate send after close", async(function*() {
        var ch, p1, p2;
        ch = chan();
        p1 = proc(function*() {
          return (yield ch.close());
        });
        p2 = proc(function*() {
          var opResult;
          assert.equal(false, opResult = send(ch, 42));
          return assert.equal(false, (yield opResult));
        });
        return (yield receive(p1));
      }));
    });
    describe("Async:", function() {
      it("sends to a pulled channel (9 13)", async(function*() {
        var asyncValue, ch, p1;
        ch = chan();
        asyncValue = null;
        p1 = proc(function*() {
          return (yield receive(ch));
        });
        (yield sleep(1));
        send.async(ch, 42, function(value) {
          return asyncValue = value;
        });
        assert.equal(42, (yield receive(p1)));
        (yield sleep(1));
        return assert.equal(true, asyncValue);
      }));
      it("sends to a detaining channel (4 6 12 14)", async(function*() {
        var asyncValue, ch;
        ch = chan();
        asyncValue = null;
        send.async(ch, 42, function(value) {
          return asyncValue = value;
        });
        assert.equal(42, (yield receive(ch)));
        return assert.equal(true, asyncValue);
      }));
      return it("receives from a pushed channel (6 14)", async(function*() {
        var asyncValue, ch, p1;
        ch = chan();
        p1 = proc(function*() {
          return (yield send(ch, 42));
        });
        (yield sleep(1));
        asyncValue = null;
        receive.async(ch, function(value) {
          return asyncValue = value;
        });
        assert.equal(true, (yield receive(p1)));
        (yield sleep(1));
        return assert.equal(42, asyncValue);
      }));
    });
    describe("polling:", function() {
      it("polls", function() {
        var ch;
        ch = chan();
        send.async(ch, 42);
        return assert.equal(poll(ch), 42);
      });
      it("fails if channel is EMPTY", function() {
        var ch;
        ch = chan(2);
        assert(ch.buffer.isEmpty());
        return assert.equal(poll(ch), poll.EMPTY);
      });
      return it("fails if channel is PULLED", function() {
        var ch;
        ch = chan();
        receive.async(ch);
        return assert.equal(poll(ch), poll.EMPTY);
      });
    });
    describe("offering:", function() {
      it("offers", function() {
        var ch;
        ch = chan();
        receive.async(ch);
        return assert.equal(offer(ch, 42), true);
      });
      it("fails if channel is FULL", function() {
        var ch;
        ch = chan(2);
        send.async(ch, 42);
        send.async(ch, 43);
        assert(ch.buffer.isFull());
        return assert.equal(offer(ch, 44), false);
      });
      it("fails if channel is PUSHED", function() {
        var ch;
        ch = chan();
        send.async(ch, 42);
        return assert.equal(offer(ch, 42), false);
      });
      return it("fails if channel is CLOSED", function() {
        var ch;
        ch = chan();
        receive.async(ch);
        ch.close();
        return assert.equal(offer(ch, 42), false);
      });
    });
    describe("Transduction:", function() {
      return it("transforms, filters, expands, terminates", async(function*() {
        var ch, char, cube, isEven, notZero, p1, p2, string, toInt, xf;
        cube = function(n) {
          return n * n * n;
        };
        isEven = function(n) {
          return n % 2 === 0;
        };
        string = function(x) {
          return x.toString();
        };
        char = function(s) {
          return s.split('');
        };
        toInt = function(s) {
          return parseInt(s, 10);
        };
        notZero = function(n) {
          return n !== 0;
        };
        xf = comp(map(cube), filter(isEven), map(string), mapcat(char), map(toInt), takeWhile(notZero));
        ch = chan(xf);
        p1 = proc(function*() {
          var i, results;
          i = 0;
          results = [];
          while (!ch.isClosed()) {
            results.push((yield send(ch, ++i)));
          }
          return results;
        });
        p2 = proc(function*() {
          var results;
          results = [];
          while (!ch.isDone()) {
            results.push((yield receive(ch)));
          }
          return results;
        });
        return assert.deepEqual([8, 6, 4, 2, 1, 6, 5, 1, 2, 1], (yield receive(p2)));
      }));
    });
    describe("single:", function() {
      it("delivers without transduction", async(function*() {
        var ch, i, pp;
        ch = chan.single();
        assert(ch.buffer == null);
        pp = (function() {
          var j, results;
          results = [];
          for (i = j = 1; j <= 3; i = ++j) {
            results.push(proc(function*() {
              return assert.equal(42, (yield receive(ch)));
            }));
          }
          return results;
        })();
        return (yield receive(proc(function*() {
          return (yield send(ch, 42));
        })));
      }));
      it("delivers with transduction", async(function*() {
        var ch, char, gtTwo, i, pp, string, toInt;
        string = function(n) {
          return n.toString();
        };
        char = function(s) {
          return s.split('');
        };
        toInt = function(s) {
          return parseInt(s, 10);
        };
        gtTwo = function(n) {
          return n > 2;
        };
        ch = chan.single(comp(map(string), mapcat(char), map(toInt), filter(gtTwo)));
        assert(ch.buffer != null);
        pp = (function() {
          var j, results;
          results = [];
          for (i = j = 1; j <= 3; i = ++j) {
            results.push(proc(function*() {
              return assert.equal(3, (yield receive(ch)));
            }));
          }
          return results;
        })();
        return (yield receive(proc(function*() {
          return (yield send(ch, 1337));
        })));
      }));
      return it("keeps its promises", async(function*() {
        var ch, p1, p2, sleeper, waiter;
        ch = chan.promise();
        p1 = proc(function*() {
          var value;
          value = (yield receive(ch));
          assert.equal(value, 42);
          return (yield send(waiter, 'p1'));
        });
        p2 = proc(function*() {
          var value;
          value = (yield receive(ch));
          assert.equal(value, 42);
          return (yield send(waiter, 'p2'));
        });
        waiter = proc(function*() {
          var n, results;
          n = 2;
          results = [];
          while (n--) {
            results.push((yield receive()));
          }
          return results;
        });
        sleeper = proc(function*() {
          (yield sleep(1));
          return (yield send(ch, 42));
        });
        return assert.deepEqual((yield receive(waiter)), ['p1', 'p2']);
      }));
    });
    return describe("lift:", function() {
      var fn, fs, name, ref2;
      fs = {};
      ref2 = require('fs');
      for (name in ref2) {
        fn = ref2[name];
        if (!/_|Sync$/.test(name)) {
          fs[name] = chan.lift(fn);
        }
      }
      return it("looks like sync, runs like async", async(function*() {
        var data, resolved, text;
        resolved = (yield receive(fs.realpath('.')));
        text = (yield receive(fs.readFile('package.json', 'utf8')));
        data = JSON.parse(text);
        return assert(resolved.endsWith(data.name));
      }));
    });
  });

}).call(this);
