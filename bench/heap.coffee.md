    {proc, chan, send, receive, final, sleep} = require '..'
    profiler = require 'heapdump'



    profiler.writeSnapshot "heaps/one.heapsnapshot"

    global.channels = for i in [0..1e4]
      chan 1
    global.processes = for ch in channels
      do (ch) -> proc -> yield receive ch

    profiler.writeSnapshot "heaps/two.heapsnapshot"
