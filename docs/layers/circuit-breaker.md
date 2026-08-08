# Circuit Breaker

When a cache store becomes unavailable, every operation still pays for the round-trip before failing. That is usually a connection timeout, which means the cache stops making your application faster and starts making it slower than having no cache at all.

The [circuit breaker](https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern) layer counts those failures and, once they cross a threshold, stops calling the store entirely for a while. Instead of waiting for a timeout, the operations fail immediately with a `CircuitBreakerOpenError`.

The circuit has three states:

- **Closed**: the store is healthy and every operation goes through it. Failures are counted.
- **Open**: the store is considered unavailable. Operations fail immediately without reaching it.
- **Half-open**: after the reset timeout, a single operation is let through to check whether the store recovered. If it succeeds the circuit closes, if it fails the circuit opens again.

```ts
import { CircuitBreakerCache } from 'cachimbo';

const circuitBreakerCache = new CircuitBreakerCache({
  cache: anotherCache, // underlying cache store
  failureThreshold: 5, // failures needed to open the circuit
  failureWindow: 10, // time window in seconds in which the failures are counted
  resetTimeout: 30, // seconds the circuit stays open before probing the store again
  successThreshold: 1, // successful probes needed to close the circuit
});
```

## Combining with the Fail-Safe layer

This layer throws when the circuit is open, so on its own it turns a cache outage into an application outage. It is meant to sit **below** a [Fail-Safe](./fail-safe.md) layer, which decides what your application should do with the error:

```ts
import { FailSafeCache, CircuitBreakerCache, RedisCache } from 'cachimbo';

const cache = new FailSafeCache({
  cache: new CircuitBreakerCache({
    cache: new RedisCache({ client: redisClient }),
  }),
  onError: (operation, error) => reportToMonitoring(operation, error),
});

const data = await cache.getOrLoad("mykey", () => loadData());
// While Redis is healthy, this reads from Redis
// While the circuit is open, this loads from origin without waiting for a Redis timeout
```

The two layers answer different questions, which is why they are separate:

| Layer                 | Question                                               |
|-----------------------|--------------------------------------------------------|
| `CircuitBreakerCache` | Should the store be called at all right now?           |
| `FailSafeCache`       | What should happen when a call fails?                  |

## Monitoring

Use the `onStateChange` callback to know when the circuit trips. An opening circuit means your cache store is down, which is usually worth an alert:

```ts
const circuitBreakerCache = new CircuitBreakerCache({
  cache: anotherCache,
  onStateChange: (state, previousState) => {
    console.warn(`Cache circuit moved from ${previousState} to ${state}`);
  },
});
```

You can also read the current state at any time:

```ts
circuitBreakerCache.getState(); // 'closed' | 'open' | 'half-open'
```

The thrown error carries the error that actually opened the circuit as its `cause`, which is what you want in a log:

```ts
try {
  await circuitBreakerCache.get("mykey");
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    console.error(`"${error.operation}" was skipped, the cache is down:`, error.cause);
  }
}
```

## Remarks

- Errors thrown by the `load` function of `getOrLoad` come from your origin, not from the cache, so they never open the circuit.
- Only one probe runs at a time in the half-open state. Any other operation fails immediately, so a recovering store is not flooded with requests.
- The failure count uses a rolling window. Failures older than `failureWindow` are discarded, so a single error every few minutes never accumulates until it trips the circuit.
- Operations that were already in flight when the circuit changed state do not affect the new state. Under load there are usually many requests running when the circuit trips, and counting their failures would keep pushing the reset timeout forward, while counting their successes could close the circuit without a real probe ever succeeding.
- Writes and invalidations are short-circuited just like reads. A `delete()` that is skipped while the circuit is open leaves a stale entry in the store, which will be served once it recovers. If that is unacceptable for your data, keep the deletion `fail-closed` in the [Fail-Safe](./fail-safe.md) layer above and retry it in your application.
- This layer is only useful for external cache stores. In-memory caches do not fail, so a circuit breaker only adds overhead.
