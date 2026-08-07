# NATS as a Cache Store

[NATS](https://nats.io/) is an open source, distributed, lightweight messaging system and key-value store.

The library has built-in support for the [nats.js](https://github.com/nats-io/nats.js#readme) client through the `NatsCache` class.

```sh
npm install @nats-io/kv @nats-io/transport-node
```
```ts
import { NatsCache } from 'cachimbo';
import { connect } from '@nats-io/transport-node';
import { Kvm } from '@nats-io/kv';

const nc = await connect({ servers: "demo.nats.io:4222" });
const kvm = new Kvm(nc);
const cacheKv = await kvm.create("mycache", {
  ttl: 20_000, // TTL of 20 seconds
  storage: 'memory', // if you don't need to persistence
  history: 0, // if you don't need history
});

const cache = new NatsCache({ kv: cacheKv });
```

## Remarks

- NATS KV does not support per-item TTL, so the TTL is set at the bucket level. This means that all items in the cache will have the same TTL, which may not be ideal for all use cases.
  - The `ttl` option is ignored on writes. Avoid layers that depend on a per-item TTL on top of this store, such as [TTL Jittering](../layers/jittering.md).
- NATS KV does not support batch operations, so methods like `getMany`, `setMany` and `deleteMany` will operate on keys one by one, which may have performance implications for large batches.
- NATS KV only supports `[-/_=.a-zA-Z0-9]` characters in keys, so you may need to encode/decode keys if you want to use other characters.
