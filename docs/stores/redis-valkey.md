# Redis/Valkey as a Cache Store

The library has built-in support for three Redis/Valkey clients:
- [node-redis](https://www.npmjs.com/package/redis) through the `RedisCache` class
- [@valkey/valkey-glide](https://www.npmjs.com/package/@valkey/valkey-glide) through the `ValkeyGlideCache` class
- [ioredis](https://www.npmjs.com/package/ioredis) or [iovalkey](https://www.npmjs.com/package/iovalkey) through the `IORedisCache` class

If you don't know which one to use, choose `node-redis` when running Redis or `@valkey/valkey-glide` when running Valkey.

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

### @valkey/valkey-glide

```ts
import { GlideClient } from "@valkey/valkey-glide";
import { ValkeyGlideCache } from 'cachimbo';

const valkeyClient = await GlideClient.createClient({
  addresses: [{
    host: "localhost",
    port: 6379,
  }],
});

const valkeyCache = new ValkeyGlideCache({
  client: valkeyClient,
});
```

### ioredis & iovalkey

```ts
import Redis from 'ioredis'; // or import Valkey from 'iovalkey';
import { IORedisCache } from 'cachimbo';

const redisClient = new Redis("redis://user:password@localhost:6380");

const redisCache = new IORedisCache({
  client: redisClient,
});
```

## Remarks

If you're running Redis OSS 8.4.0 or newer, set the `isMSETEXSupported` option to `true`, as it will optimize the `setMany()` method by using the `MSETEX` command instead of individual `SET` commands.

Valkey does not support `MSETEX` yet.
