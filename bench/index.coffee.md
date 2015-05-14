    Benchmark = require 'benchmark'

    pch = require '..'
    csp = require 'js-csp'

    {proc, chan, send, receive} = pch




## Benchmarking

Compares performance of common process–channel operations between the **prochan** and **js-csp** libraries. Results are presented as a multiplier of the **Benchmark.js** ops-per-second scores for **prochan** normalized to the corresponding score for **js-csp**.



### Setup

    CLEAR = '\b'.repeat 80


A **Benchmark.js** async function provides a `deferred` object to be `resolve`d when its run is complete. To translate this into CSP, for each library we define a `defer` function, which takes a process generator function `gf` and returns its equivalent Benchmark-able async function.

    do ->
      defer = ({go, take}) -> (gf, args) -> (deferred) -> go ->
        yield take go gf, args
        do deferred.resolve
        return
      pch.defer = defer pch
      csp.defer = defer csp


    powerOf = (b) -> (x) -> if x? then b**x else x


    progress = (n) ->
      example  = "[—————— 57% ····]"
      paver    = "#{n*100|0}%"
      length   = 76 - paver.length
      behind   = n * length | 0
      ahead    = length - behind
      asphalt  = '—'.repeat behind
      gravel   = '·'.repeat ahead
      "#{CLEAR}[#{asphalt} #{paver} #{gravel}]"


#### bench

Returns a generator function that performs each run of the defined m×n matrix, then outputs the tabulated results, normalized to the **js-csp** scores.

    bench = (description, options, pchGen, cspGen) -> ->
      {maxTime, base, expM, expN} = options

      baseP   = " #{base}".slice -2
      nCycles = 2 * expM.length * expN.length
      nDone   = 0

      run = (m,n) ->
        p = proc -> yield receive()
        suite = new Benchmark.Suite()
          .add 'prochan',
            defer: yes
            maxTime: maxTime
            fn: pch.defer pchGen, arguments
          .add 'js-csp',
            defer: yes
            maxTime: maxTime
            fn: csp.defer cspGen, arguments
          .on 'cycle', ->
            process.stdout.write progress ++nDone / nCycles
          .on 'complete', ->
            send.async p, this, null
          .run()
        p

      process.stdout.write "\n\n#{description}\n\n" + progress nDone / nCycles

      matrix = []
      for n, i in expN.map powerOf base
        #row = ["       N=#{base}^#{expN[i]}".slice(-7)]
        #matrix.push row
        matrix.push row = []
        for m in expM.map powerOf base
          { '0':{hz:hz0}, '1':{hz:hz1} } = yield receive run m, n
          row.push "#{hz0/hz1}".concat('000').slice(0,5)

      table =
        "     M= " +
          (for m in expM
            if m? then "| #{baseP}^#{m}  " else "|  null ").join('') + '\n' +
        "-------:" + "|:-----:".repeat(expM.length) + '\n' +
        matrix
          .map( (a) -> a.join ' | ' )
          .map( (s,i) -> "       N=#{base}^#{expN[i]} | ".slice(-10).concat s )
          .join('\n')
          .concat('\n')

      process.stdout.write "\n\n#{table}\n"

      "#{description}\n\n#{table}"



---

### Benchmarks

    proc ->

      yield receive proc bench "N processes created",
        maxTime: 5
        base: 4
        expM: [null]
        expN: [2..8]

        (m,n) ->
          for i in [1..n] then pch.proc -> yield return
          yield return

        (m,n) ->
          for i in [1..n] then csp.go -> yield return
          yield return


      yield receive proc bench "
        N channels created, unbuffered and fixed-buffered of size M.
        ",
        maxTime: 5
        base: 10
        expM: [null].concat [0..4]
        expN: [2..5]

        (m,n) ->
          for i in [1..n] then pch.chan m
          yield return

        (m,n) ->
          for i in [1..n] then csp.chan m
          yield return


      yield receive proc bench "
        Two processes perform N operations, first over an unbuffered channel,
        then by channels with fixed buffer size M.
        ",
        maxTime: 5
        base: 10
        expM: [null].concat [0..4]
        expN: [2,4,6]

        (m,n) ->
          ch = pch.chan m
          p1 = pch.proc ->
            for i in [1..n] then yield pch.send ch, i
            return
          p2 = pch.proc ->
            for i in [1..n] then yield pch.receive ch
            return
          yield pch.receive p2
          return

        (m,n) ->
          ch = csp.chan m
          p1 = csp.go ->
            for i in [1..n] then yield csp.put ch, i
            return
          p2 = csp.go ->
            for i in [1..n] then yield csp.take ch
            return
          yield csp.take p2
          return


      yield receive proc bench "
        M processes perform N operations over a single unbuffered channel.
        ",
        maxTime: 5
        base: 4
        expM: [1..5]
        expN: [3..5]

        (m,n) ->
          ch = pch.chan()
          ps = for i in [1..m]
            pch.proc ->
              for j in [1..n] then yield pch.send ch, j
              return
          pr = pch.proc ->
            for i in [1..m*n] then yield pch.receive ch
            return
          yield pch.receive pr
          return

        (m,n) ->
          ch = csp.chan()
          ps = for i in [1..m]
            csp.go ->
              for j in [1..n] then yield csp.put ch, j
              return
          pr = csp.go ->
            for i in [1..m*n] then yield csp.take ch
            return
          yield csp.take pr
          return
