# Cloudflare Workers KV as a Cache Store

KV is a distributed, low-latency, key-value data store available in Cloudflare's global network.

If you're building on top of Cloudflare Workers, you can use the KV storage as a distributed cache.

This is designed to be used with the [Workers Binding API](https://developers.cloudflare.com/kv/concepts/kv-bindings/).

```ts
import { WorkersKVCache } from 'cachimbo';

const cache = new WorkersKVCache({
  kv: env.YOUR_KV_NAMESPACE,
});

await cache.set("key", "value", { ttl: 60 }); // 60 seconds

const data = await cache.get("key"); // "value"
```

## Remarks

- Cloudflare Workers KV has eventual consistency, which means that there might be a delay before a recently written value is visible to subsequent reads. This is important to consider when designing your caching strategy.
- KV also does not support TTLs shorter than 60 seconds.

More information about Cloudflare Workers KV can be found in the [official documentation](https://developers.cloudflare.com/kv/concepts/how-kv-works/).
