# Stale While Revalidate

When a cache entry expires and the system needs to fetch fresh data, the request can take a long time to complete.

The “Stale While Revalidate” strategy avoids this delay by immediately returning the previously cached value while asynchronously refreshing the data in the background.

This keeps read latency consistently low, even during cache refreshes.

This strategy is similar to the [stale-while-revalidate in browser caching](https://web.dev/articles/stale-while-revalidate).

```ts
import { SWRCache } from 'cachimbo';

const swrCache = new SWRCache({
  cache: anotherCache,
  defaultTTL: 60, // Default TTL that the resource will remain fresh
  staleTTL: 10, // Additional TTL that the resource will keep cached but stale
});

// This strategy only has effect when using the getOrLoad method.

const data = await swrCache.getOrLoad("key", () => loadData());
// From 0 to 60 seconds, the resource will return from the underlying cache
// From 60 to 70 seconds, the resource will return from the underlying cache and a load request will start in background
// After 70 seconds, the item will be completely removed from cache, and any new requests will have to load the resource in foreground
```

<center>
    <img src="../assets/swr.svg" alt="Stale While Revalidate Cache">
</center>

In the example above, the resource is cached. After a few seconds, the cache becomes stale but is still served from the cache while a background refresh is triggered. Once the background refresh completes, the cache is updated with fresh data.

All requests coming in during the stale period receive the stale data immediately, ensuring low latency. The data is still being refreshed in the background, so subsequent requests after the refresh will receive the updated data.
