# Extending Cachimbo

Cachimbo is designed to be easily extendable. You can create your own caching strategies by implementing the `ICache` interface. This allows you to integrate custom caching mechanisms or modify existing ones to suit your specific needs.

```ts
import { ICache } from 'cachimbo';

class MyCache implements ICache {
  async get<T>(key: string): Promise<T | null> {
    /* your implementation */
  }
  async getOrLoad<T>(key: string, load: () => Promise<T>, options?: SetCacheOptions): Promise<T> {
    /* your implementation */
  }
  async set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    /* your implementation */
  }
  async delete(key: string): Promise<void> {
    /* your implementation */
  }
  async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    /* your implementation */
  }
  async setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void> {
    /* your implementation */
  }
  async deleteMany(keys: string[]): Promise<void> {
    /* your implementation */
  }
}
```

Alternatively, you can extend existing `BaseCache` implementation, which requires only implementing the `get()`, `set()` and `delete()` methods, other methods are already implemented falling back into these three.

```ts
import { BaseCache, BaseCacheOptions } from 'cachimbo';

class MyCache extends BaseCache {
  constructor(options: BaseCacheOptions = {}) {
    super(options);
  }

  async get<T>(key: string): Promise<T | null> {
    /* your implementation */
  }

  async set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    /* your implementation */
  }

  async delete(key: string): Promise<void> {
    /* your implementation */
  }
}
```
