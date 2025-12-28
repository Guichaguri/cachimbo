# Redis/Valkey as a Cache Store

Redis, Valkey and Garnet are a distributed, key-value store and message broker.
You can self-host it or use a managed service (such as Redis Cloud, Amazon ElastiCache, Azure Cache and Google Cloud Memorystore).

The library has built-in support for three Redis/Valkey/Garnet clients:
- [node-redis](https://www.npmjs.com/package/redis) through the `RedisCache` class
- [@valkey/valkey-glide](https://www.npmjs.com/package/@valkey/valkey-glide) through the `ValkeyGlideCache` class
- [ioredis](https://www.npmjs.com/package/ioredis) or [iovalkey](https://www.npmjs.com/package/iovalkey) through the `IORedisCache` class

If you don't know which one to use, choose `node-redis` when running Redis or `@valkey/valkey-glide` when running Valkey.

These two are the recommended clients by Redis and Valkey, respectively, and are the most actively maintained.

### node-redis

```sh
npm install @redis/client
```
```ts
import { createClient } from '@redis/client';
import { RedisCache } from 'cachimbo';

const redisClient = await createClient({
  url: "redis://user:password@localhost:6379",
});

await redisClient.connect();

const redisCache = new RedisCache({
  client: redisClient,
});
```

### @valkey/valkey-glide

```sh
npm install @valkey/valkey-glide
```
```ts
import { GlideClient } from "@valkey/valkey-glide";
import { ValkeyGlideCache } from 'cachimbo';

const valkeyClient = await GlideClient.createClient({
  addresses: [{
    host: "localhost",
    port: 6379,
  }],
  credentials: {
    username: "user",
    password: "password",
  },
});

const valkeyCache = new ValkeyGlideCache({
  client: valkeyClient,
});
```

### ioredis & iovalkey

```sh
npm install ioredis # if you want to use Redis
# or
npm install iovalkey # if you want to use Valkey
```
```ts
import Redis from 'ioredis'; // or import Valkey from 'iovalkey';
import { IORedisCache } from 'cachimbo';

const redisClient = new Redis("redis://user:password@localhost:6379");

const redisCache = new IORedisCache({
  client: redisClient,
});
```

## Remarks

The library supports all Redis/Valkey/Garnet versions, and some optimizations can be enabled for newer versions:

- If you're running Redis OSS **8.4.0 or newer**, set the `isMSETEXSupported` option to `true`.
  - This will optimize the `setMany()` method by using the `MSETEX` command instead of individual `SET` commands.
- If you're running Redis OSS **older than 4.0.0**, set the `isUNLINKSupported` option to `false`.
  - This will use the `DEL` command instead of the `UNLINK` command.
- If you're running Valkey or Garnet, don't set any of these options.
