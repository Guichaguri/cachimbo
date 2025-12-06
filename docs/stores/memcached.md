# Memcached as a Cache Store

The library has built-in support for two Memcache clients:
- [Memcache](https://www.npmjs.com/package/memcache) through the `MemcacheCache` class
- [MemJS](https://www.npmjs.com/package/memjs) through the `MemJSCache` class

### Memcache

```ts
import { Memcache } from 'memcache';
import { MemcacheCache } from 'cachimbo';

const memcacheClient = new Memcache('localhost:11211');

const memcacheCache = new MemcacheCache({
  client: memcacheClient,
});
```

### MemJS

```ts
import { Client } from 'memjs';
import { MemJSCache } from 'cachimbo';

const memjsClient = Client.create('localhost:11211');

const memjsCache = new MemJSCache({
  client: memjsClient,
});
```

## Notes

MemJS does not support getting multiple keys at once. Therefore, the `getMany()` method will internally call `get()` for each key.
