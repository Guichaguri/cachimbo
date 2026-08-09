# Tiered Cache (multi-layer caching)

When fetching data from an external cache introduces a few milliseconds of latency, introducing a small in-memory cache can significantly cut down on repeated round-trips.

The Tiered Cache strategy organizes caches into multiple levels, checking each tier in order until the requested data is found. Once a hit occurs, the strategy backfills the earlier tiers to keep them warm, improving the performance of future lookups.

A common recommendation is to use two tiers: a small in-memory cache as the first level and your external cache as the second. The in-memory cache should have a short time-to-live to minimize the risk of serving stale data when the external cache is updated.

The concept behind the tiered cache is also known as multi-level caching, L1/L2/L3 caching, CPU caching, hierarchical caching or hybrid caching.

```ts
import { TieredCache } from 'cachimbo';

const tieredCache = new TieredCache({
  tiers: [
    {
      cache: new LocalTTLCache({
        max: 100, // 100 items stored at most to limit memory usage
      }),
      options: {
        ttl: 30, // Keep any entry cached locally for only 30 seconds
      },
    },
    {
      cache: new RedisCache(...),
    },
  ],
});

const data = await tieredCache.getOrLoad("key", () => loadData(), { ttl: 60 * 5 });
// The tiered cache will first check the LocalTTLCache for the "key"
// If it's not found, it will then check the RedisCache for the "key"
// If it's also not found, it will finally run loadData()
// After loading the data, it will backfill all caches with the loaded data

// Saving the data into the RedisCache with a TTL of 5 minutes,
// and also saving it to the LocalTTLCache with a TTL of 30 seconds

// Once the resource expires from the LocalTTLCache, requesting again will load it from the RedisCache
// and then backfill the LocalTTLCache for more 30 seconds
```

<p align="center">
    <img src="../assets/tiered.svg" alt="Tiered Cache">
</p>

In the example above, the tiered cache first checks the in-memory cache for the requested key. If the key is not found there, it checks the external cache, backfilling the in-memory cache to reduce latency on future reads.

## Options per tier

The `options` of a tier take precedence over the options given to `set()`, `setMany()` and `getOrLoad()`, so each tier always keeps its own TTL. Anything a tier does not configure falls back to the options given by the caller.

```ts
const tieredCache = new TieredCache({
  tiers: [
    { cache: new LocalTTLCache(), options: { ttl: 30 } },
    { cache: new RedisCache(...) },
  ],
});

await tieredCache.set("key", data, { ttl: 300 });
// The in-memory cache uses its own TTL of 30 seconds
// Redis has no TTL configured, so it uses the 300 seconds from the caller
```

This means a tier without `options` never stores an entry without a TTL when the caller provided one.
