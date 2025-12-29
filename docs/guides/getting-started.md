# Getting Started with Cachimbo

### Installation

First, install Cachimbo via your preferred package manager:

```sh
npm install cachimbo
```
```sh
yarn add cachimbo
```
```sh
pnpm install cachimbo
```
```sh
bun add cachimbo
```

### Creating the cache instance

Then, initialize the cache store and layers you want to use.
For example, to create an [in-memory cache](../stores/in-memory.md#time-to-live-ttl) with a [Stale-While-Revalidate layer](../layers/stale-while-revalidate.md) on top:

```ts
import { LocalTTLCache, SWRCache, ICache } from 'cachimbo';

let cache: ICache;

// Create an in-memory cache with TTL eviction
cache = new LocalTTLCache({
  max: 100, // maximum number of items in cache (optional)
});

// Wrap it with a Stale-While-Revalidate layer
cache = new SWRCache({
  cache: cache,
  defaultTTL: 60 * 15, // 15 minutes
  staleTTL: 60, // 1 minute
});
```

You can also use other cache stores such as Redis, Memcached or Valkey, Cloudflare Workers KV, or even Keyv as the underlying storage.
Check [all available cache stores and layers](../README.md), you also might need help to [choose the right combination of layers](./choosing-layers.md).

### Reading and writing data

You can now read and write data from cache in various ways:

##### `getOrLoad`

```ts
// Get or fetch data
const data = await cache.getOrLoad<MyData>(
  "mykey", // the cache key
  () => loadData(), // function to load data if not in cache
  { ttl: 60 * 3 }, // cache for 3 minutes
);
```

##### `get`

```ts
// Get data by key, returns the object cached or null if not found
const data = await cache.get<MyData>("mykey");
```

##### `set`

```ts
// Save data by key
await cache.set<MyData>(
  "mykey", // the cache key
  { title: 'Hello World' }, // the JSON-serializable data to save in cache
  { ttl: 60 }, // cache for 60 seconds
);
```

##### `delete`

```ts
// Delete a cached resource by key
await cache.delete("mykey");
```

##### `getMany`

```ts
// Gets multiple cached resources by their keys
const { mykey, anotherKey } = await cache.getMany<MyData>(["mykey", "anotherKey"]);
```

##### `setMany`

```ts
// Saves multiple cached resources by their keys
await cache.setMany<MyData>(
  {
    mykey: { title: 'Hello World' },
    anotherKey: { title: 'Another Value' },
  },
  { ttl: 120 }, // cache for 120 seconds
);
```

##### `deleteMany`

```ts
// Deletes multiple cached resources by their keys
await cache.deleteMany(["mykey", "anotherKey"]);
```
