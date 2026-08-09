# Memcached as a Cache Store

Memcached is an open source, distributed, non-persistent key-value store.
You can self-host it or use a managed service (such as Amazon ElastiCache and Google Cloud Memorystore).

The library has built-in support for two Memcache clients:
- [Memcache](https://www.npmjs.com/package/memcache) through the `MemcacheCache` class
- [MemJS](https://www.npmjs.com/package/memjs) through the `MemJSCache` class

If you don't know which one to use, choose `memcache` as it is the most actively maintained.

### Memcache

```sh
npm install memcache
```
```ts
import { Memcache } from 'memcache';
import { MemcacheCache } from 'cachimbo';

const memcacheClient = new Memcache('localhost:11211');

const memcacheCache = new MemcacheCache({
  client: memcacheClient,
});
```

### MemJS

```sh
npm install memjs
```
```ts
import { Client } from 'memjs';
import { MemJSCache } from 'cachimbo';

const memjsClient = Client.create('localhost:11211');

const memjsCache = new MemJSCache({
  client: memjsClient,
});
```

## Remarks

- MemJS does not support getting multiple keys in batch. Therefore, the `getMany()` method will internally call `get()` for each key.
- Keep your TTLs below 30 days (2592000 seconds). Above that limit, Memcached reads the value as an absolute Unix timestamp instead of a relative duration, which makes the entry expire immediately.
- Memcached keys are limited to 250 characters and cannot contain spaces or control characters. Use a [Key Transformation](../layers/key-transformation.md) layer to hash keys if yours may exceed that.
