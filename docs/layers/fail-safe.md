# Fail-Safety

When a cache backend fails (e.g. connection failures, timeouts or even hardware errors), it is often better to disable caching than to fail completely.

The [Fail Safe](https://en.wikipedia.org/wiki/Fail-safe) cache layer provides [two policies](https://read.thecoder.cafe/p/fail-open-fail-closed) that can be applied to each cache operation:
- **Fail-Open**: In this mode, when a cache operation fails (e.g., due to a connection error), the layer ignores the error.
  - For `get` operations, it returns `null`, and for `getOrLoad`, it loads the data from the source function. This allows your application to continue functioning normally, albeit without the performance benefits of caching.
- **Fail-Closed**: In this mode, when a cache operation fails, the layer throws an error, propagating it up to the caller.
  - This is useful when you want to ensure that cache failures are explicitly handled by your application.

```ts
import { FailSafeCache } from 'cachimbo';

const failSafeCache = new FailSafeCache({
  cache: anotherCache, // underlying cache store
  policy: {
    get: 'fail-open', // returns null on get errors
    set: 'fail-open', // ignores set errors
  }
});

await failSafeCache.get("mykey"); // returns null if anotherCache fails
await failSafeCache.set("mykey", "value"); // does nothing if anotherCache fails
```

Use the `onError` callback to log errors or send them to an error tracking service:

```ts
const failSafeCache = new FailSafeCache({
  cache: anotherCache, // underlying cache store
  policy: {
    get: 'fail-open', // returns null on get errors
    set: 'fail-closed', // throws on set errors
    delete: 'fail-closed', // throws on delete errors
    getOrLoad: 'fail-open', // loads from source on errors
  },
  onError: (operation, error) => {
    console.error(`Cache operation "${operation}" failed:`, error);
    // You can also send the error to an external monitoring service here
  }
});
```

You should always log cache errors somewhere, as they can indicate issues with your cache backend that need attention.

## Remarks

- The Fail Safe layer is recommended for use with external cache stores (like Redis, Memcached, etc.) where failures are more likely to occur.
- For in-memory caches, failures should never happen, so the Fail Safe layer is usually unnecessary.
- Be cautious when using the Fail-Open policy, as it can lead to increased load on your data source if the cache is frequently failing.
- Consider combining the Fail Safe layer with monitoring tools to keep track of cache health and performance.
