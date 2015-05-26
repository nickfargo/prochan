## Helpers

    module.exports = do ->

      {hasOwnProperty:has} = Object::


#### isArray

      isArray: Array.isArray ? (a) -> a? and typeof a is 'object' and
                                             typeof a.splice is 'function' and
                                             typeof a.length is number


#### alias

      alias: (map, objects...) ->
        for o in objects
          for s, t of map when has.call o, s
            for t in t.split /\s+/ when not has.call o, t
              o[t] = o[s]
        return


#### pooled

Class decorator.

Adds static method `alloc` that provides pooled instances, and instance method
`free` for reclamation. The provided `constructor` must define initialization
values for all instance properties.

      pooled: (constructor) ->
        constructor.POOL_SIZE = 4096
        constructor.pool = []

        constructor.alloc = ->
          @pool = [] unless has.call this, 'pool'
          instance = @pool.pop() or new this
          @apply instance, arguments
          instance

        constructor::free = do ->
          free = ->
            c = @constructor
            c.apply this, arguments
            c.pool.push this if c.pool.length < c.POOL_SIZE

          super__ = (constructor.__super__ ? constructor::?constructor::)?.free
          if super__? then ->
            super__.apply this, arguments
            free.apply this, arguments
          else free

        constructor


#### attenuate

Takes a list of `methodNames` and returns an `Attenuator` class whose instances
proxy a hidden `client` with a corresponding subset of the `client`’s methods.

Does not support properties/getters/setters.

```js
var ImmutableArray = attenuate('concat slice join indexOf');
var ia = new ImmutableArray([1,2,3]);
```

      attenuate: (methodNames) ->
        if typeof methodNames is 'string'
          methodNames = methodNames.split /\s+/
        includes = {}
        includes[name] = yes for name in methodNames

        class Attenuator
          constructor: (client) ->
            @['@@attenuator'] = (name, args) ->
              throw new TypeError unless includes[name]?
              result = client[name].apply client, args
              if result is client then this else result

          for name in methodNames then do (name) =>
            @::[name] = -> @['@@attenuator'] name, arguments


#### AbstractGenerator

Extend this to manually write a generator constructor.

      AbstractGenerator: class AbstractGenerator
        constructor: ->
          @_result = value: undefined, done: no
          @_step = 0
          # add stack-copy vars here
        yield: (value) ->
          @_result.value = value
          @_result
        next: -> do @return # override this
        return: (value) ->
          @_result.done = yes
          @yield value
        throw: (error) -> throw error
