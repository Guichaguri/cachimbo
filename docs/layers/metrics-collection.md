# Metrics Collection

To measure the cache effectiveness, you can add a `MetricsCollectingCache` layer. It will collect how many times the cache was hit, missed, refreshed and deleted.

```ts
import { MetricsCollectingCache } from 'cachimbo';

const metricsCache = new MetricsCollectingCache({
  cache: anotherCache,
});

// metricsCache.get("something")

console.log(metricsCache.getMetrics());
/* {
  hitCount: 0,
  missCount: 1,
  loadCount: 0,
  setCount: 0,
  deleteCount: 0,
  hitTime: 0,
  missTime: 12,
  loadTime: 0,
  setTime: 0,
  deleteTime: 0,
} */
```

## Remarks

- This implementation adds some overhead to each cache operation due to the time measurement and metric counting. It's not recommended for production use.
- Time in batch operations (`getMany`, `setMany` and `deleteMany`) are divided equally among all keys involved in the operation when calculating metrics.
- `getOrLoad` counts as a `hit` if the value was found in cache, otherwise it counts as a `miss`, then a `load` when the value is loaded using the provided loader function, and finally a `set`.
- The time of `set` in `getOrLoad` is calculated from the time it finished loading from source to the time the function returns, which means it may not work as expected in some cache implementations.
  - In case of caches that perform asynchronous sets in the background (like `SWRCache`), the time recorded will not reflect the actual time taken to set the value in cache.
