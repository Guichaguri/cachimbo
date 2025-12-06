<img align="right" src="./docs/assets/cachimbo.png" alt="Cachimbo" width="150" height="150">

# cachimbo

Cachimbo is a caching library that allows you to layer different strategies in order to maximize the performance.

## Features

- Supports external cache stores
  - Redis
  - Memcached
  - Cloudflare Workers KV
- Supports in-memory cache stores
  - Least Recently Used (LRU)
  - Time To Live (TTL)
  - Map-based
- Supports intermediary cache strategies
  - Request coalescing (deduplication)
  - Multi-layer caching (tiered cache)
  - Stale-While-Revalidate
- Metrics collection
- Easily extendable

## Usage

First, install the library:
```sh
npm install cachimbo
```

Then, initialize the cache stores and layers you want to use. For example:

```ts
import { RedisCache, SWRCache } from 'cachimbo';

// A Redis cache with a Stale-While-Revalidate layer on top
const cache = new SWRCache({
  cache: new RedisCache({
    client: redisClient, // your Redis client instance
  }),
  defaultTTL: 60 * 15, // 15 minutes
  staleTTL: 60, // 1 minute
});


const data = await cache.getOrLoad<MyData>(
  "mykey", // the cache key
  () => loadData(), // function to load data if not in cache
  { ttl: 60 * 3 }, // cache for 3 minutes
);


// Other useful methods:
// cache.get("key");
// cache.set("key", data, { ttl: 120 });
// cache.delete("key");
// cache.getMany(["key1", "key2"]);
// cache.setMany({ key1: value1, key2: value2 }, { ttl: 300 });
// cache.deleteMany(["key1", "key2"]);
```

## Cache Stores

In-memory caches offer extremely low latency since data is stored directly in the application’s process. They reduce external round-trips, improve performance under load, and are ideal for fast, frequently accessed data.

External caches (like Redis, Memcached, etc) provide fast, scalable, shared storage that can be accessed across multiple application instances. They offer high throughput, larger memory capacity, and centralized cache management beyond what in-memory caches can reliably provide.

- [In-memory](./docs/stores/in-memory.md)
- [Redis](./docs/stores/redis.md)
- [Memcached](./docs/stores/memcached.md)
- [Cloudflare Workers KV](./docs/stores/cloudflare-workers-kv.md)

## Cache Layers

These layers work just like "middlewares" but for caches, they customize how a cache is handled.

- [Request Coalescing](./docs/layers/request-coalescing.md) (deduplication)
- [Tiered Caching](./docs/layers/tiered.md) (multi-layer caching)
- [Stale-While-Revalidate](./docs/layers/stale-while-revalidate.md)
- [Metrics Collection](./docs/layers/metrics-collection.md)

## Guides
- [Choosing the right combination of layers](./docs/guides/choosing-layers.md)
- [Disabling cache](./docs/guides/disabling.md)
- [Extending](./docs/guides/extending.md)
