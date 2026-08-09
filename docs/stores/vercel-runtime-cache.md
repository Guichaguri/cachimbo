# Vercel Runtime Cache as a Cache Store

The [Runtime Cache](https://vercel.com/docs/caching/runtime-cache) is a managed key-value store that Vercel exposes to Functions, Routing Middleware and Builds.

If you're deploying to Vercel, it gives you a cache shared across every instance of your deployment without provisioning any infrastructure.

The library has built-in support for the [@vercel/functions](https://www.npmjs.com/package/@vercel/functions) package through the `VercelRuntimeCache` class.

```sh
npm install @vercel/functions
```
```ts
import { getCache } from '@vercel/functions';
import { VercelRuntimeCache } from 'cachimbo';

const cache = new VercelRuntimeCache({
  cache: getCache(),
});

await cache.set("key", "value", { ttl: 60 }); // 60 seconds

const data = await cache.get("key"); // "value"
```

`getCache()` accepts a `namespace` option, which prefixes the keys so that unrelated parts of your application don't collide:

```ts
const cache = new VercelRuntimeCache({
  cache: getCache({ namespace: 'posts' }),
});
```

## Tag invalidation

The Runtime Cache invalidates by tag on its own. Write the items with a `tags` list and call `expireTag()` to expire all of them at once:

```ts
await cache.set("post:1", post, { ttl: 3600, tags: ["posts"] });

// Later, when the posts change
await cache.invalidateTag("posts");
```

This is not the same mechanism as the [Tagging](../layers/tagging.md) layer, and the two are worth comparing before picking one:

- The native tags are invalidated server-side and take effect immediately, at no extra read cost, but they only work on this store.
- The `TaggedCache` layer works on top of any store and invalidates lazily, by checking the tags of an entry on read, which costs one extra cache operation per tag.

Prefer the native tags when this store is the only one you cache into. Reach for the layer when you want the same tagging behavior across stores, or when a tiered cache means an invalidation also has to reach an in-memory tier.

## Remarks

- Values are stored JSON-serialized, so they **must** be JSON stringifiable.
- The Runtime Cache has no batch commands, so `getMany`, `setMany` and `deleteMany` operate on keys one by one, in parallel.
- `getCache()` hashes the keys itself and can namespace them, so a [Key Transformation](../layers/key-transformation.md) layer is usually unnecessary in front of this store.
  - The `name` option on writes is only used by Vercel's observability, and defaults to the key you passed rather than the hashed one that is actually stored.
- Outside of a Vercel deployment, such as when running locally, `getCache()` falls back to an in-memory cache scoped to the process. This keeps the code working in development, but that cache is not shared between instances and does not survive a restart.
- A missing item reads as `undefined`, which makes a cached `null` indistinguishable from a miss. See the [negative caching](../guides/negative-caching.md) guide if you need to cache the absence of a resource.
- Stacking a `TaggedCache` on top of this store also writes its tags as native Vercel tags, since the write options are passed through. Its `invalidateTag()` still does not call `invalidateTag()` — the two remain independent.

More information about the Runtime Cache can be found in the [official documentation](https://vercel.com/docs/caching/runtime-cache).
