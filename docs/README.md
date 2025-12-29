<img align="right" src="./assets/cachimbo.png" alt="Cachimbo" width="150" height="150">

# cachimbo

```sh
npm install cachimbo
```

## Guides
- [Getting Started](./guides/getting-started.md)
- [Choosing the right combination of layers](./guides/choosing-layers.md)
- [Disabling cache](./guides/disabling.md)
- [Testing](./guides/testing.md)
- [Extending](./guides/extending.md)
- [Samples](../samples)

## Cache Stores
- [In-memory](./stores/in-memory.md)
- [Redis](stores/redis-valkey.md) (and Valkey)
- [Memcached](./stores/memcached.md)
- [Cloudflare Workers KV](./stores/cloudflare-workers-kv.md)
- [Keyv](./stores/keyv.md)

## Cache Layers

- [Request Coalescing](./layers/request-coalescing.md) (deduplication)
- [Tiered Caching](./layers/tiered.md) (multi-layer caching)
- [Stale-While-Revalidate](./layers/stale-while-revalidate.md)
- [TTL Jittering](./layers/jittering.md)
- [Async/Lazy Initialization](./layers/async-lazy.md)
- [Key Transformation](./layers/key-transformation.md)
- [Metrics Collection](./layers/metrics-collection.md)
