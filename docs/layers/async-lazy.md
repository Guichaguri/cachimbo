# Asynchronously or lazily initializing a cache

Some cache stores require asynchronous initialization, such as connecting to a remote database or service. To handle this, Cachimbo provides the `AsyncCache` layer, which allows you to have a cache ready for use without having to deal with promises on construction.

The `AsyncLazyCache` can also be used to lazy-load caches that are expensive to create, only initializing them when they are first used.

### Async initialization

```ts
import { AsyncCache, RedisCache } from 'cachimbo';
import { createClient } from '@redis/client';

const cache = new AsyncCache({
  // The factory function first connects to Redis, then creates the RedisCache
  factory: async () => {
    const redisClient = await createClient({
      url: "redis://user:password@localhost:6380",
    });

    return new RedisCache({ client: redisClient });
  },
  // Setting lazy to false makes it initialize immediately in background
  lazy: false,
});

// At this moment, the factory function has been called in background
// Calling any method will wait for the ongoing initialization to complete first
const data = await cache.get('key');
```

### Lazy initialization

```ts
import { AsyncCache, LocalTTLCache } from 'cachimbo';

const cache = new AsyncCache({
  factory: () => new LocalTTLCache(),
  lazy: true, // whether it will initialize immediately (false) or on first use (true)
});

// At this moment, LocalTTLCache was not initialized yet

const data = await cache.get('key');

// Now the LocalTTLCache is initialized
```
