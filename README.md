# prochan.js

I/O-enabled communicating sequential **[`proc`](https://github.com/nickfargo/prochan/blob/master/src/index.coffee.md#proc)esses** via **[`chan`](https://github.com/nickfargo/prochan/blob/master/src/index.coffee.md#chan)nels**.

---

Influenced by **[Go](https://golang.org/)** and by [Clojure’s **core.async**](https://github.com/clojure/core.async).

Compares favorably to the excellent **[js-csp](https://github.com/ubolonton/js-csp)**, a faithful port of **core.async**, with the addition of process I/O semantics, among other features.

Explores in particular the treatment of processes as first-class I/O primitives, such as this would imply:

- common interface and composability characteristics shared by processes and proper channels
- that a process communicating via I/O is itself an expression of a “logical channel”
- that such processes are generally interchangeable with channels for any channel-based API


#### Features

- Core CSP entities corresponding to those described by **Go** and **core.async**:
  - Primitives:
    - **processes** (“goroutines”)
    - buffered/unbuffered **channels**
  - Operations:
    - `receive` (`take`)
    - `send` (`put`)
    - `select` (`alts`)
- Support for affixing functional transforms to channels via Clojure-style **transducers**
- Structural simplifications and optimizations for **performance**, particularly at scale
  - Zero allocations per channel operation
  - True constant-time arbitrary-value buffering queues, with no amortized-linear copying
  - Space-efficient doubly-linked-list internal queues, with immediate splicing, no invalidation checks, no deferred GC
  - Pooled instances of internal classes
- Clear, approachable [**annotated source code**](https://github.com/nickfargo/prochan/tree/master/src/index.coffee.md)


#### Design

- Directly targets any platform supporting ES6 generator functions
- Compatible to as far down as ES3 using manual generator-iterators
- Elegantly sourced in [**Literate Coffee**](http://coffeescript.org/#literate).


#### Goals

- Rich **process** constructs, system snapshots, diagnostics, visualizations, etc.
- Feature parity to the whole of **core.async**, where appropriate for JS
- Straightforward translation to alternative async models, e.g. Node, Promises, Rx, etc.



## Installation

`npm install prochan`



## Examples

All sample code that follows will presume bindings to these functions imported from **prochan**:

```js
import {proc, chan, receive, send, final, select} from 'prochan';
```


### Basic operations


#### Processes: [`proc`](https://github.com/nickfargo/prochan/blob/master/src/index.coffee.md#proc)

Spawning a process is performed by calling the `proc` function, and passing it a generator function. Outwardly this corresponds to calling `go` or similar in other environments:

```js
let p = proc( function* () {
  // ... yield ...
});
// >>> Process
```

The key distinction of `proc` is that, whereas a call to `go` or similar would return a single-use channel as an indirection to the eventual return value of a “goroutine”, `proc` returns an actual **[`Process`](https://github.com/nickfargo/prochan/blob/master/src/process.coffee.md)** object.

However, given equivalent generator functions, the `Process` returned by `proc` may still be consumed in the same manner as the channel returned by `go`:

```js
'foo' === yield go( function* () { return 'foo'; } );
'foo' === yield proc( function* () { return 'foo'; } );
```

> _Discussed further below: **[Process I/O](#process-io)**._


#### Channels: [`chan`](https://github.com/nickfargo/prochan/blob/master/src/index.coffee.md#chan)

The `chan` function is used in generally familiar fashion to construct an unbuffered, buffered, and/or transduced **[`Channel`](https://github.com/nickfargo/prochan/blob/master/src/channel.coffee.md)**:

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

> _Discussed further below: **[Transduction](#transduction)**._


#### Communication: [`receive`](https://github.com/nickfargo/prochan/blob/master/src/index.coffee.md#receive), [`send`](https://github.com/nickfargo/prochan/blob/master/src/index.coffee.md#send)

Basic communications via channels are performed inside a process by `yield`ing the effect of a `receive` or `send` operation (aliased to `take` and `put`, respectively):

```js
proc( function* () {
  let value = yield receive(ch1);
});
proc( function* () {
  let value = 'foo';
  yield send(ch1, value);
});
```

##### Implicit `receive`

A process may also directly `yield` a channel, which causes the process to automatically perform a `receive` operation on that channel. Thus the first example above may be expressed equivalently as:

```js
proc( function* () {
  let value = yield ch1;
});
```

#### Selection: [`select`](https://github.com/nickfargo/prochan/blob/master/src/selector.coffee.md#select)

In **prochan** the `select` operation (aliased to `alts`) returns a **[`Selector`](https://github.com/nickfargo/prochan/blob/master/src/selector.coffee.md) generator**, intended for immediate use inside a *delegated yield* (`yield*`) expression:

```js
proc( function* () {
  let {value, channel} = yield* select([ch1, 42], ch2, ch3);
});
```

> _Discussed further below, with examples of advanced use cases: **[Delegated selection](#delegated-selection)**._



### Distinguishing features


#### Process I/O

In **prochan** a process may communicate over its own built-in I/O channels.

```js
proc( function* () {
  let p1 = proc( function* () {
    // (1)
    let value = yield receive();
    yield send(value + 1);
  });
  // (2)
  send.async( p1, 42 );
  43 === yield receive(p1);
});
```

1. Inside the current process (`p1`), a 0-ary `receive` call implies communication over the process’s **input** channel, and likewise a 1-ary `send` call implies communication over the process’s **output** channel.

2. Outside the current process, the process `p1` may be directly passed as an argument to a channel operation, just as if it were a proper channel. When data is *sent* to the process, it is redirected through the process’s **input** channel; and likewise when data is *received* from the process, it is drawn from the process’s **output** channel.

By default processes are constructed without I/O channels; an unbuffered channel is instated automatically as needed at either end the first time a channel operation sends to or receives from the process.


#### Channel values and results

In **prochan** channels impose no domain restrictions on input values.

In particular, channels do not force appropriation of `null` or `undefined`, nor introduce any other unique sentinel identity. All entities may be conveyed through the channel as their own instrinsic value.

A channel may be **closed** with an optional final **result value**. This is generally analogous to the return value of a function: by default a channel’s result value is `undefined`, but may be set specifically to any value provided in the call to the channel’s idempotent [`close`](https://github.com/nickfargo/prochan/blob/master/src/channel.coffee.md#close) method. Once a channel is both *closed* and *empty* it becomes **done**, after which any process that `receive`s from the channel will have the fixed result value conveyed immediately to it.

> This design leaves channel domain semantics entirely to the discretion of process authors, who may establish between themselves any special entities (e.g., whether or not some particular value `receive`d from a channel — such as `null` or `undefined` — is indeed meant to be interpreted as a special in-band “done” signal).

Idiomatic *done*-signaling is performed out-of-band by enclosing a channel operation expression in a call to the `final` predicate.


```js
// Process whose sole responsibility is to read from a channel
proc( function* () {
  let value;
  while (!final(value = yield ch)) {
    // ... consume `value`s until `ch` is done ...
  }
  // Optionally, pass along the final result value received from `ch`.
  return value;
});
```


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

To support Clojure-style [**transducers**](http://clojure.org/transducers), a channel implementation must accommodate any possible **expansion steps** in the transducer stack. For this the channel must be outfitted with an **expandable buffer**, to which a series of values produced by a single expansion step of the transducer may be added, possibly beyond the nominal length of the buffer, and which must be drained back down to below the buffer’s nominal length before more inputs are accepted.

In **prochan**, tranducers may be attached to unbuffered channels as well, ostensibly, by outfitting the channel with a provisional **zero-length buffer**, which only accepts a series of values from a transducer’s expansion step as input, all of which must be drained completely before more inputs are accepted.

In this way the transduced, “unbuffered” channel may perform the buffering necessary for transduction, while outwardly retaining the synchronization characteristics of an unbuffered channel.

```js
import {compose, map, filter, mapcat} from 'transducers.js';

let ch1 = chan();
let ch2 = chan( compose( map(f), filter(p), mapcat(g) ) );
```

Here both `ch1` and `ch2` exhibit the behavior of unbuffered channels — even though `ch2`, due to its attached transducer, may buffer any series of multiple values produced by the transducer’s expanding `mapcat` step.




---

👋

