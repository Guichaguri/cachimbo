import type { ICache, SetCacheOptions } from '../../types/cache.js';

interface BaseKeyTransformingCacheOptions {
  /**
   * The underlying cache
   */
  cache: ICache;
}

interface KeyTransformerFnCacheOptions extends BaseKeyTransformingCacheOptions {
  /**
   * The function that will be called with each key to transform it.
   * @param key The original key
   * @return The transformed key
   */
  transform: (key: string) => string;
  prefix?: never;
  suffix?: never;
}

interface KeyAffixCacheOptions extends BaseKeyTransformingCacheOptions {
  /**
   * The prefix to add to keys
   */
  prefix?: string;

  /**
   * The suffix to add to keys
   */
  suffix?: string;
}

export type KeyTransformingCacheOptions = KeyAffixCacheOptions | KeyTransformerFnCacheOptions;

/**
 * A cache layer that changes keys before passing them to the underlying cache.
 *
 * This layer can be used to:
 * - Create namespaced caches, avoiding conflicts with shared cache servers.
 * - Add a version number, allowing schema changes without causing incompatibility.
 * - Implement any other key transformations, such as normalizing or hashing.
 */
export class KeyTransformingCache implements ICache {
  protected readonly cache: ICache;
  protected transform: (key: string) => string;

  constructor(options: KeyTransformingCacheOptions) {
    this.cache = options.cache;

    if ('transform' in options && typeof options.transform === 'function') {
      this.transform = options.transform;
    } else {
      const prefix = options.prefix || '';
      const suffix = options.suffix || '';
      this.transform = (key: string) => `${prefix}${key}${suffix}`;
    }
  }

  get<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(this.transform(key));
  }

  getOrLoad<T>(key: string, load: () => Promise<T>, options?: SetCacheOptions): Promise<T> {
    return this.cache.getOrLoad(this.transform(key), load, options);
  }

  set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    return this.cache.set(this.transform(key), value, options);
  }

  delete(key: string): Promise<void> {
    return this.cache.delete(this.transform(key));
  }

  async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    const transformedKeys = keys.map(key => this.transform(key));
    const data = await this.cache.getMany<T>(transformedKeys);

    return Object.fromEntries(
      Object.entries(data).map(([transformedKey, value]) => [
        keys[transformedKeys.indexOf(transformedKey)],
        value,
      ]),
    );
  }

  setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void> {
    return this.cache.setMany(
      Object.fromEntries(
        Object.entries(data).map(([key, value]) => [this.transform(key), value]),
      ),
      options,
    )
  }

  deleteMany(keys: string[]): Promise<void> {
    return this.cache.deleteMany(keys.map(key => this.transform(key)));
  }
}
