# Key Transformation

There are a few scenarios where you would want to use the same cache store but change the keys used to store and retrieve values.

For example, you might want to add a prefix to all keys to avoid collisions when sharing a cache store among different applications or modules.

You might also want to version your keys by adding a suffix to the key, allowing you to avoid cache incompatibility when your data schema changes.

Cachimbo provides a `KeyTransformingCache` layer that allows you to apply custom transformations to the keys before passing them to the underlying cache.

```ts
import { KeyTransformingCache, RedisCache } from 'cachimbo';

const prefixedCache = new KeyTransformingCache({
  cache: new RedisCache({ ... }),
  prefix: 'myapp:',
  // suffix: '',
});

const config = await prefixedCache.get("config"); // actually retrieves "myapp:config" from Redis
```

Alternatively, you can provide a custom function to transform the keys:

```ts
const prefixedCache = new KeyTransformingCache({
  cache: underlyingCache,
  transform: (key) => `myapp:${key.replace('/', ':').toLowerCase()}`,
});
```

## Notes
- This layer is not recommended for in-memory caches as you can easily create separate instances for different key namespaces.
