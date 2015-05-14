# prochan.js

I/O-enabled communicating sequential `proc`esses via `chan`nels.


#### Influences

Draws from [**Go**][0], and heavily from [cljs/**core.async**][1]. Comparable to the excellent [**js-csp**][2], a considerably less-faithless port of **core.async**.

Explores the space of treating **processes** as first-class I/O primitives, and as such, effectively as **logical channels**, with all the composability that implies.


#### Features

- Superset of the core CSP operations described by **Go** and **core.async**
- Support for compositional transforms via Clojure-style **transducers**
- **Performance**, particularly at scale
- Clear, minimal, approachable **annotated source**


#### Aims

- Rich **process** constructs, system snapshots, diagnostics, etc.
- Feature parity to the whole of **core.async**, where appropriate for JS
- Translatability to **alternative async models**, e.g. Node, Promises, Rx, etc.


#### Design

Targets platforms supporting ES6 generator functions, but also compatible down to ES3 using manual iterators. Sourced (for now) in [**Literate Coffee**][3].



### Installation

`npm install prochan`



### Examples


#### `select`/`alts`

The `select` expression (also aliased to `alts`) uses delegated (`yield*`) generator functions, allowing for an expressive alternate syntax:

###### ES6

```js
import {assert} from 'chai';
import {proc, chan, send, receive, select, sleep} from 'prochan';

describe("select/alts expression", function () {
  it("supports simple inline form", proc.async( function* () {
    const ch1 = chan(), ch2 = chan(), ch3 = chan();
    proc( function * () {
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
      yield* select
        .send( [ch1, 1337], function* (value, channel) {
          assert( false, "unreachable" );
        })
        .receive( ch2, ch3, function* (value, channel) {
          assert.equal( value, 42 );
          assert.equal( channel, ch3 );
          return 'foo';
        })
        // ...
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
        # ...
```



---

> ... TODO: api overview, ...

---

👋




[0]: https://golang.org/
[1]: https://github.com/clojure/core.async
[2]: https://github.com/ubolonton/js-csp
[3]: http://coffeescript.org/#literate
