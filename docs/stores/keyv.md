# Keyv as a Cache Store

Keyv is a simple key-value storage library for Node.js that supports multiple backends.

Although both Keyv and Cachimbo provide Redis, Valkey, Memcached and Cloudflare Workers KV support, they have different focuses and features:
- Keyv is primarily a key-value store with support for various backends like SQLite, Etcd, MongoDB, etc. It is designed to be a simple and flexible storage solution.
- Cachimbo is a more comprehensive caching library that offers advanced caching strategies (like Stale-While-Revalidate, multi-layer caching, request coalescing) and built-in support for various cache stores.
- Cachimbo aims to support only cache-specific backends (such as Redis and Memcached) while Keyv supports general-purpose databases (such as PostgreSQL and MongoDB).

If you need to implement one of the backends that Keyv supports but Cachimbo does not, you can create a Cachimbo cache store that uses Keyv as the underlying storage.

```ts
import { KeyvCache } from 'cachimbo';
import Keyv from 'keyv';
import KeyvSqlite from '@keyv/sqlite';

const keyv = new Keyv(new KeyvSqlite('sqlite://path/to/database.sqlite'));

const keyvCache = new KeyvCache({
  store: keyv,
});
```

For instance, you could use a Tiered Cache with an in-memory cache as the first layer and a Keyv cache (backed by PostgreSQL) as the second layer:

```ts
import { TieredCache, LocalTTLCache, KeyvCache } from 'cachimbo';
import Keyv from 'keyv';
import KeyvPostgres from '@keyv/postgres';

const keyv = new Keyv(new KeyvPostgres('postgresql://user:password@localhost:5432/database'));

const tieredCache = new TieredCache({
  tiers: [
    {
      cache: new LocalTTLCache({ max: 100, ttl: 60 }),
    },
    {
      cache: new KeyvCache({
        store: keyv,
      })
    },
  ],
});
```

This cache would first attempt to retrieve data from the in-memory cache. If the data is not found there, it would then check the Keyv cache backed by PostgreSQL. Think of it as a warm cache and a cold cache setup, where the in-memory cache serves as the fast-access layer and the Keyv cache provides persistent storage.
