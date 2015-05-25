# prochan.js

I/O-enabled communicating sequential `proc`esses via `chan`nels.

Influenced by [**Go**][0] and by [Clojure’s **core.async**][1]. Fundamentally comparable to the excellent [**js-csp**][2], a faithful port of **core.async**.

Explores the treatment of **processes** as first-class I/O primitives, and thus as logical channels themselves when used as such, with interface and composability characteristics in common with proper channels.


#### Features

- Core CSP entities corresponding to those described by **Go** and **core.async**:
  - Primitives: **processes**/`go`routines, buffered/unbuffered **channels**
  - Operations: `receive`/`take`, `send`/`put`, `select`/`alts`
- Support for affixing functional transforms to channels via Clojure-style **transducers**
- Structural optimizations for **performance**, particularly at scale
- Clear, approachable **annotated source code**


#### Design

- Directly targets any platform supporting ES6 generator functions
- Compatible to as far down as ES3 using manual generator-iterators
- Elegantly sourced in [**Literate Coffee**][3].


#### Goals

- Rich **process** constructs, system snapshots, diagnostics, etc.
- Feature parity to the whole of **core.async**, where appropriate for JS
- Translatability to alternative async models, e.g. Node, Promises, Rx, etc.



## Installation

`npm install prochan`



## Examples

Code that follows presumes bindings of these standard imports from **prochan**:

```js
import {proc, chan, receive, send, select} = 'prochan';
```

> These core operations are also aliased to names that reflect their general correspondence to their counterparts in **core.async**:

> ```js
  import {go, chan, take, put, alts} = 'prochan';
  ```


### Basic operations


#### Processes: `proc`

Spawning a process is performed by calling the `proc` function, and passing it a generator function. Outwardly this corresponds to calling `go` or similar in other environments:

```js
let p = proc( function* () {
  // ... yield ...
});
// >>> Process
```

The key distinction of `proc` is that, whereas a `go` call would return a single-use `Channel` as an indirection to the eventual return value of a “goroutine”, `proc` returns an actual `Process` object.

However, given equivalent generator functions, the `Process` returned by `proc` may still be consumed in the same manner as the channel returned by `go`:

```js
'foo' === yield receive( go( function* () { return 'foo'; } ) );
'foo' === yield receive( proc( function* () { return 'foo'; } ) );
```

> _Discussed further below under **Process I/O**._


#### Channels: `chan`

The `chan` function is generally familiar, used to construct unbuffered, buffered, and/or transduced channels.

```js
let ch1 = chan();
```

```js
let ch2 = chan(42);
let ch3 = chan.sliding(42);
let ch4 = chan.dropping(42);
```

```js
import {compose} from 'transducers.js';
let transducer = compose(...transducers);
let ch5 = chan(1, transducer);
let ch6 = chan(transducer);  // No explicit buffering, behaves as unbuffered
```

> _Discussed further below under **Transduction**._


#### Communication: `receive`/`take`, `send`/`put`

Basic communications via channels are performed inside a process by `yield`ing the effect of a `receive` or `send` operation (aliased to `take` and `put`, respectively):

```js
proc( function* () {
  let value = yield receive( ch1 );
});
proc( function* () {
  let value = 'foo';
  yield send( ch1, value );
});
```

#### Selection: `select`/`alts`

In **prochan** the `select` (aliased to `alts`) operation returns a `Selector` *generator*, and so must be contained in a *delegated yield* (`yield*`) expression.

```js
proc( function* () {
  let {value, channel} = yield* select([ch1, 42], ch2, ch3);
});
```

> _Discussed further below, with examples of advanced use cases, under **Delegated selection**._



### Distinguishing features


#### Process I/O

Processes may communicate over their own I/O channels. Internally, a 0-ary `receive` call implies communication over the **in** channel of the current process; a 1-ary `send` call implies communication over the **out** channel of the current process. Externally, since processes implement the standard channel operations, they may be passed as arguments to channel operations, just like a proper channel.

```js
proc( function* () {
  let p1 = proc( function* () {
    let value = yield receive();
    yield send( value + 1 );
  });
  send.async( p1, 42 );
  yield receive( p1 );
});
```

Unbuffered process I/O channels are created on demand.

> TODO: Add `proc` interface for specific I/O channel construction, including e.g. buffering, transduction, etc.


#### Delegated selection

In **prochan** a `select` (or alias `alts`) expression evaluates to a delegated generator, and so is always to be paired with `yield*`. This design allows for the **cases** of a `select` expression to be:

- composed by chaining methods, e.g. `send`/`receive`, `else`, etc.
- each distinguished by an optional `label`, or
- each associated with a generator function, to which the selector will delegate if an operation defined by that case is selected

Thus, at the user’s discretion, `select` may take any of several forms:

##### Basic form

```js
let {value, channel} = yield* select([ch1, 42], ch2, ch3);
```

##### Labeled form

```js
while (true) {
  // Destructure the yielded selector
  let {label, value, channel} = yield* select
    .send( [ch1, 42], 'foo' )
    .receive( ch2, ch3, 'bar' )
    .else('baz');
  // Then branch against `label`
  if (label === 'foo') {
    // ...
  }
  else if (label === 'bar') {
    // ...
  }
  else if (label === 'baz') {
    // alternative, selected if none of the other cases’ operations is ready
  }
}
```

##### Delegated form

```js
let ch1 = chan(), ch2 = chan(), ch3 = chan();

// Prepare a value to be received from `ch3` ...
send.async( ch3, 'qux' );

// ... and observe the effect on `select`:
'qux' === yield receive( proc( function* () {
  return yield* select
    // this case won’t be selected
    .send( [ch1, 42], function* (value, channel) {
      throw new Error;
    })
    // this case will be selected
    .receive( ch2, ch3, function* (value, channel) {
      return value;
    })
    .else( function* () {
      // alternative
    });
}));
```


#### Transduction

```js
import {compose, map, filter, mapcat} from 'transducers.js';

let ch1 = chan();
let ch2 = chan( compose( map(f), filter(p), mapcat(g) ) );
```

Here both `ch1` and `ch2` are unbuffered channels. To exhibit unbuffered synchronization behavior and also support transduction, `ch2` includes a provisional **zero-length buffer**, to which items may be added during a single expansion step of the transducer, and which must be emptied completely before the next input is accepted.


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
