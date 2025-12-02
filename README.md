# Cachimbo

Cachimbo is a caching library that allows you to layer different strategies in order to maximize the performance.

## Features

- Supports external cache stores
  - Redis
  - Memcached
  - CloudFlare Workers KV
- Supports in-memory cache stores
  - Least Recently Used (LRU)
  - Time To Live (TTL)
- Supports intermediary cache strategies
  - Request coalescing (deduplication)
  - Multi-layer caching (tiered cache)
  - Stale-While-Revalidate

## Cache Stores

### External Stores

External caches like Redis and Memcached provide fast, scalable, shared storage that can be accessed across multiple application instances. They offer high throughput, larger memory capacity, and centralized cache management beyond what in-memory caches can reliably provide.

#### Redis

The library has built-in support for two Redis clients:
- [node-redis](https://www.npmjs.com/package/redis) through the `RedisCache` class
- [ioredis](https://www.npmjs.com/package/ioredis) through the `IORedisCache` class

```ts
import { createClient } from '@redis/client';
import { RedisCache } from 'cachimbo/redis';

const redisClient = await createClient({
  url: "redis://user:password@localhost:6380",
});

const redisCache = new RedisCache({
  client: redisClient,
});
```

#### Memcached

The library has built-in support for two Memcache clients:
- [Memcache](https://www.npmjs.com/package/memcache) through the `MemcacheCache` class
- [MemJS](https://www.npmjs.com/package/memjs) through the `MemJSCache` class

```ts
import { Memcache } from 'memcache';
import { MemcacheCache } from 'cachimbo/memcache';

const memcacheClient = new Memcache('localhost:11211');

const memcacheCache = new MemcacheCache({
  client: memcacheClient,
});
```

#### CloudFlare Workers KV

If you're building on top of CloudFlare Workers, you can use the KV storage as a caching layer.

```ts
import { WorkersKVCache } from 'cachimbo/workers-kv';


const kvCache = new WorkersKVCache({
  kv: env.YOUR_KV_NAMESPACE,
});
```

### In-memory Stores

In-memory caches offer extremely low latency since data is stored directly in the application’s process. They reduce external round-trips, improve performance under load, and are ideal for fast, frequently accessed data.

#### Least Recently Used (LRU)

Use an LRU cache when memory is limited and you want to keep the most recently used items available, automatically evicting older, less-used entries.

It is built on top of the [lru-cache](https://www.npmjs.com/package/lru-cache).

#### Time To Live (TTL)

If you don’t need an access-pattern awareness, a TTL cache is faster, simpler, and often sufficient when data naturally expires after a fixed duration.

It is built on top of the [@isaacs/ttlcache](https://www.npmjs.com/package/@isaacs/ttlcache).

#### No Operation (disabling cache)

You can keep your code as-is and disable cache just by initializing the `NoOpCache`.
Nothing will be cached.

```ts
import { NoOpCache } from 'cachimbo/noop';


const cache = new NoOpCache();

// cache.get("anything") === null
```

#### Map

// TODO?

## Cache Strategies

Cache Strategies are just like "middlewares" but for caches, they customize how a cache is handled.

### Deduplication (request coalescing)

When two parallel requests ask for the same cache key, they would normally both hit the external cache server.

The deduplication strategy prevents this by tracking in-flight requests: if a fetch for a given key is already in progress, additional requests for that key wait for the existing one instead of triggering another call to the external server.

```ts
import { CoalescingCache } from 'cachimbo/strategies';

const dedupeCache = new CoalescingCache({
  cache: anotherCache,
});
```

### Stale While Revalidate

When a cache entry expires and the system needs to fetch fresh data, the request can take a long time to complete.

The “Stale While Revalidate” strategy avoids this delay by immediately returning the previously cached value while asynchronously refreshing the data in the background.

This keeps read latency consistently low, even during cache refreshes.  

```ts
import { SWRCache } from 'cachimbo/strategies';

const swrCache = new SWRCache({
  cache: anotherCache,
  defaultTTL: 60, // Default TTL that the resource will remain fresh
  staleTTL: 10, // Additional TTL that the resource will keep cached but stale
});

const data = await swrCache.getOrLoad("key", () => loadData());
// From 0 to 60 seconds, the resource will return from the underlying cache
// From 60 to 70 seconds, the resource will return from the underlying cache but a load request will start in background
// After 70 seconds, the item will be completely removed from cache, and any new requests will have to load the resource in foreground
```

### Tiered Cache (multi-layer caching)

When fetching data from an external cache introduces a few milliseconds of latency, introducing a small in-memory cache can significantly cut down on repeated round-trips.

The Tiered Cache strategy organizes caches into multiple levels, checking each tier in order until the requested data is found. Once a hit occurs, the strategy backfills the earlier tiers to keep them warm, improving performance for future lookups.

A common recommendation is to use two tiers: a small in-memory cache as the first level and your external cache as the second. The in-memory cache should have a short time-to-live to minimize the risk of serving stale data when the external cache is updated.

```ts
import { TieredCache } from 'cachimbo/strategies';

const tieredCache = new TieredCache({
  tiers: [
    {
      cache: new LocalTTLCache({
        max: 50, // 50 items stored at most to limit memory usage
      }),
      options: {
        ttl: 30,
      },
    },
    {
      cache: new RedisCache(...),
    },
  ],
});

const data = await tieredCache.getOrLoad("key", () => loadData(), { ttl: 60 * 3 });
// The tiered cache will first check the LocalTTLCache for the "key"
// If it's not found, it will then check the RedisCache for the "key"
// If it's also not found, it will finally run loadData()
// After loading the data, it will backfill all caches with the loaded data

// Saving the data into the RedisCache with a TTL of 5 minutes,
// and also saving it to the LocalTTLCache with a TTL of 30 seconds

// Once the resource expires from the LocalTTLCache, requesting again will load it from the RedisCache
// and then backfill the LocalTTLCache with more 30 seconds
```

### Metrics Collection

To measure the cache effectiveness, you can add a `MetricsCollectingCache` layer. It will collect how many times the cache was hit, missed, refreshed and deleted.

```ts
import { MetricsCollectingCache } from 'cachimbo/strategies';

const metricsCache = new MetricsCollectingCache({
  cache: anotherCache,
});

// metricsCache.get("something")

console.log(metricsCache.metrics);
// { hit: 0, miss: 1, load: 0, set: 0, delete: 0 }
```

## Use-cases and Benchmarks

// TODO

## Extending

This library is easily extendable. You can create your own caching strategies or storages just by implementing the `ICache` interface.
Existing `ICache` implementations can also be extended.

```ts
interface ICache {
  get<T>(key: string): Promise<T | null>;
  getOrLoad<T>(key: string, load: () => Promise<T>, options?: SetCacheOptions): Promise<T>;
  set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  getMany<T>(keys: string[]): Promise<Record<string, T | null>>;
  setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
}
```

Alternatively, you can extend the `BaseCache` class. You just have to implement `get`, `set` and `delete`, as all other methods have a default implementation that fallback into these three.
