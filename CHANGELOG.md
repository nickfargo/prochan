## changelog


### 0.1.1 *(released)*

- Initial **multicast** implementation.
- Fixed value-exchange for `send.async` and `Callback`.
- Added a `chan.isFinal` function to inspect `isFinal` on the current process
  - For correct, race-proof “done” detection alongside a `receive` channel operation
  - e.g.: `let value = yield receive(ch), done = chan.isFinal();`


### 0.1.0

Initial release.
