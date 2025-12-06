<img align="right" src="./assets/cachimbo.png" alt="Cachimbo" width="150" height="150">

# cachimbo

```shell
npm install cachimbo
```

## Cache Stores
- [In-memory](./stores/in-memory.md)
- [Redis](./stores/redis.md)
- [Memcached](./stores/memcached.md)
- [Cloudflare Workers KV](./stores/cloudflare-workers-kv.md)

## Cache Layers

- [Request Coalescing](./layers/request-coalescing.md) (deduplication)
- [Tiered Caching](./layers/tiered.md) (multi-layer caching)
- [Stale-While-Revalidate](./layers/stale-while-revalidate.md)
- [Metrics Collection](./layers/metrics-collection.md)

## Guides
- [Choosing the right combination of layers](./guides/choosing-layers.md)
- [Disabling cache](./guides/disabling.md)
- [Extending](./guides/extending.md)
