<p align="center">
  <img width="200" src="https://raw.githubusercontent.com/Guichaguri/cachimbo/main/docs/assets/cachimbo.png">
</p>

<h1 align="center">Cachimbo</h1>

Cachimbo is a composable caching library that allows you to layer different strategies in order to maximize the performance.

[![NPM](https://img.shields.io/npm/v/cachimbo)](https://www.npmjs.com/package/cachimbo)
[![Coverage](https://img.shields.io/codecov/c/github/Guichaguri/cachimbo)](https://app.codecov.io/gh/Guichaguri/cachimbo)

## Features

- Supports external cache stores
  - Redis
  - Valkey
  - Memcached
  - Cloudflare Workers KV
  - Keyv
- Supports in-memory cache stores
  - Least Recently Used (LRU) eviction
  - Time-based (TTL) eviction
  - FIFO eviction
  - Weak References (garbage collectable cached items)
- Supports composable cache strategies
  - Request coalescing (deduplication)
  - Multi-layer caching (tiered cache)
  - Stale-While-Revalidate
  - TTL jittering
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

- [In-memory](/docs/stores/in-memory.md)
- [Redis](/docs/stores/redis-valkey.md) (and Valkey)
- [Memcached](/docs/stores/memcached.md)
- [Cloudflare Workers KV](/docs/stores/cloudflare-workers-kv.md)
- [Keyv](/docs/stores/keyv.md)

## Cache Layers

Cache layers are composable components that sit between your code and the cache store. While cache stores define *where* data is stored, cache layers define *how* the cache is accessed.

Each layer intercepts cache operations to add behavior. Layers can be stacked to form a pipeline, allowing advanced caching strategies to be reused across different cache backends.

- [Request Coalescing](/docs/layers/request-coalescing.md) (deduplication)
- [Tiered Caching](/docs/layers/tiered.md) (multi-layer caching)
- [Stale-While-Revalidate](/docs/layers/stale-while-revalidate.md)
- [TTL Jittering](/docs/layers/jittering.md)
- [Async/Lazy Initialization](/docs/layers/async-lazy.md)
- [Key Transformation](/docs/layers/key-transformation.md)
- [Metrics Collection](/docs/layers/metrics-collection.md)

## Guides
- [Choosing the right combination of layers](/docs/guides/choosing-layers.md)
- [Disabling cache](/docs/guides/disabling.md)
- [Extending](/docs/guides/extending.md)
- [Samples](./samples)
