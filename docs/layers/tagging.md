# Tagging

> There are only two hard things in Computer Science: cache invalidation and naming things.
> 
> -- Phil Karlton

There's no doubt that invalidating cache entries is hard. Sometimes you need to invalidate multiple related entries at once, and tracking them can be cumbersome.

The tagging layer allows you to assign tags to cached entries, making it easier to manage cache consistency, especially when dealing with complex data relationships.

```ts
import { TaggedCache } from 'cachimbo';

const taggedCache = new TaggedCache({
  cache: anotherCache,
});

await taggedCache.set('key1', 'value1', { tags: ['tagA', 'tagB'] });
await taggedCache.invalidateTag('tagA');
const value = await taggedCache.get('key1'); // === null
```

For instance, let's say you have a cache storing user profiles and their associated posts. When a user's profile is updated, you want to invalidate both the profile and all posts related to that user. By tagging the cache entries with the user's ID, you can easily invalidate all related entries in one go.

## How it works

This layer implements the same algorithm implemented in [FusionCache's Tagging](https://github.com/ZiggyCreatures/FusionCache/blob/main/docs/Tagging.md).

Under the hood, the tagging layer checks for invalidated tags during `get`, `getMany` and `getOrLoad` operations. If any of the tags associated with a cache entry have been invalidated, the entry is treated as missing.

### Complexity

The tagging layer introduces some overhead due to the additional tracking of tags and invalidation checks. The complexity of operations is as follows:

- `get` and `getOrLoad` does at least `n + 1` cache operations, being n the number of tags associated with the key.
- `getMany` does `m * n + 1` cache operations, being m the number of keys requested and n the average number of tags associated with each key.
- `invalidateTag` and `invalidateTags` does `1` cache operation.
- `set` and `setMany` does `3` cache operations.
- `delete` and `deleteMany` does `1` cache operation.

## Caveats

- If you're using an external cache, have a [Tiered Cache](./tiered.md) as the underlying cache, using a [fast in-memory cache](../stores/in-memory.md) as the first layer to mitigate the overhead.
- It's advisable to keep the number of tags per entry low (ideally 1-3) to avoid performance degradation.
- The `tagTTL` option has to be greater than or equal to the entry TTL to ensure tags remain valid for the lifetime of the entries they are associated with.
- The tagging layer adds extra data to each cache entry to store the associated tags, which may increase memory usage.
  - Be aware that this layer cannot be added on top of existing caches without risking data corruption as it changes the structure of the cached data. To avoid that, add a [Key Transformation](./key-transformation.md) layer to version the keys when adding this layer to an existing external cache.
