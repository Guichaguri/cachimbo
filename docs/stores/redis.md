# Redis as a Cache Store

The library has built-in support for two Redis clients:
- [node-redis](https://www.npmjs.com/package/redis) through the `RedisCache` class
- [ioredis](https://www.npmjs.com/package/ioredis) through the `IORedisCache` class

### node-redis

```ts
import { createClient } from '@redis/client';
import { RedisCache } from 'cachimbo';

const redisClient = await createClient({
  url: "redis://user:password@localhost:6380",
});

const redisCache = new RedisCache({
  client: redisClient,
});
```

### ioredis

```ts
import Redis from 'ioredis';
import { IORedisCache } from 'cachimbo';

const redisClient = new Redis("redis://user:password@localhost:6380");

const redisCache = new IORedisCache({
  client: redisClient,
});
```

## Notes

If you're running Redis OSS 8.4.0 or newer, set the `isMSETEXSupported` to `true`, as it will optimize the `setMany()` method by using the `MSETEX` command instead of individual `SET` commands.

Valkey does not support `MSETEX` yet.
