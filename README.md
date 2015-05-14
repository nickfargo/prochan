# prochan.js

I/O-enabled communicating sequential `proc`esses via `chan`nels.

Influenced by [**Go**][0] and by [Clojure’s **core.async**][1]. Outwardly comparable to the excellent [**js-csp**][2], a faithful port of **core.async**.

Explores the treatment of **processes** as first-class I/O primitives, and thus as logical channels themselves, with all the composability that implies.


#### Design

- Targets platforms supporting ES6 generator functions
- Also compatible down to ES3 using manual iterators
- Sourced (for now) in [**Literate Coffee**][3].


#### Features

- Core CSP operations as described by **Go** and **core.async**
- Clear, approachable **annotated source code**
- **Performance**, particularly at scale
- Support for functional transforms via Clojure-style **transducers**


#### Goals

- Rich **process** constructs, system snapshots, diagnostics, etc.
- Feature parity to the whole of **core.async**, where appropriate for JS
- Translatability to **alternative async models**, e.g. Node, Promises, Rx, etc.



### Installation

`npm install prochan`



### Examples


#### `select`/`alts`

In **prochan** the `select` expression (also aliased to `alts`) uses delegated generator functions (`yield*`), allowing for a variety of syntactical forms:

###### ES6

```js
import {assert} from 'chai';
import {proc, chan, send, receive, select, sleep} from 'prochan';

describe("select/alts expression", function () {
  it("supports simple inline form", proc.async( function* () {
    const ch1 = chan(), ch2 = chan(), ch3 = chan();
    proc( function* () {
      yield sleep(1);
      yield send( ch3, 42 );
    });
    assert.equal('foo', yield receive( proc( function* () {
      let {value, channel} = yield* select( [ch1, 1337], ch2, ch3 );
      assert.equal( value, 42 );
      assert.equal( channel, ch3 );
      return 'foo';
    })));
  }));
  it("supports chained-case delegate form", proc.async( function* () {
    const ch1 = chan(), ch2 = chan(), ch3 = chan();
    proc( function* () {
      yield sleep(1);
      yield send( ch3, 42 );
    });
    assert.equal('foo', yield receive( proc( function* () {
      return yield* select
        .send( [ch1, 1337], function* (value, channel) {
          assert( false, "unreachable" );
        })
        .receive( ch2, ch3, function* (value, channel) {
          assert.equal( value, 42 );
          assert.equal( channel, ch3 );
          return 'foo';
        });
    })));
  }));
});
```

###### Coffee 1.9

```coffee
{assert} = require 'chai'
{proc, chan, send, receive, select, sleep} = require 'prochan'

describe "select/alts expression", ->
  it "supports simple inline form", proc.async ->
    ch1 = chan(); ch2 = chan(); ch3 = chan()
    proc -> yield sleep 1; yield send ch3, 42
    assert.equal 'foo', yield receive proc ->
      {value, channel} = yield from select [ch1, 1337], ch2, ch3
      assert.equal value, 42
      assert.equal channel, ch3
      'foo'
  it "supports chained-case delegate form", proc.async ->
    ch1 = chan(); ch2 = chan(); ch3 = chan()
    proc -> yield sleep 1; yield send ch3, 42
    assert.equal 'foo', yield receive proc ->
      yield from select
        .send [ch1, 1337], (value, channel) ->
          assert false, "unreachable"; yield return
        .receive ch2, ch3, (value, channel) ->
          assert.equal value, 42
          assert.equal channel, ch3
          yield return 'foo'
```



---

> TODO:
  - api overview
  - additional distinguishing examples
  - ...

---

👋




[0]: https://golang.org/
[1]: https://github.com/clojure/core.async
[2]: https://github.com/ubolonton/js-csp
[3]: http://coffeescript.org/#literate
