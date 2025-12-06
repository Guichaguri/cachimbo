# Disabling cache

Adding conditions to your own code can be cumbersome, especially when you want to disable caching for specific environments, such as development or testing.

This is why there is a built-in `NoOpCache` implementation that you can use to effectively disable caching without changing the rest of your code.

```ts
import { NoOpCache } from 'cachimbo';

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
// Always returns `null` on NoOpCache
await cache.get('product:123');
```
