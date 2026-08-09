# Disabling cache

Adding conditions to your own code can be cumbersome, especially when you want to disable caching for specific environments, such as development or testing.

##### ❌ Don't do this:

```ts
import { LocalTTLCache } from 'cachimbo';

const cache = new LocalTTLCache();
```
```ts
if (process.env.CACHE_DISABLED !== 'true') {
  await cache.set('product:123', myProduct, { ttl: 30 });
}
```
```ts
let product;

if (process.env.CACHE_DISABLED === 'true') {
  product = await fetchProduct();
} else {
  product = await cache.getOrLoad('product:123', () => fetchProduct());
}
```

This is why there is a built-in `NoOpCache` implementation that you can use to effectively disable caching without changing the rest of your code.

##### ✅ Do this:

```ts
import { NoOpCache, LocalTTLCache, ICache } from 'cachimbo';

function initializeCache(): ICache {
  if (process.env.CACHE_DISABLED === 'true') {
    return new NoOpCache();
  }
  
  // Initialize and return the desired cache here
  return new LocalTTLCache();
}

const cache = initializeCache();
```
```ts
// Saves the product into the cache with a TTL of 30 seconds
// Does nothing on NoOpCache
await cache.set('product:123', myProduct, { ttl: 30 });

// Returns the cached product on an actual cache implementation
// Always calls the loader function on NoOpCache
const product = await cache.getOrLoad('product:123', () => fetchProduct());
```

Instead of sprinkling your code with `if` statements to check if caching is enabled, you can simply use the `NoOpCache` implementation. This allows you to keep your code clean and maintainable while still having the flexibility to disable caching when needed.
