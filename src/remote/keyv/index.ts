import { BaseCache } from '../../base/index.js';
import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';
import type Keyv from 'keyv';

export interface KeyvCacheOptions extends BaseCacheOptions {
  /**
   * The underlying key-value store
   */
  keyv: Keyv;
}

/**
 * A cache store backed by a Keyv instance.
 *
 * Useful to reach a backend that Cachimbo does not implement natively, such as SQLite, PostgreSQL,
 * MongoDB or Etcd. Serialization, TTL handling and batching are all delegated to Keyv and its store adapter.
 *
 * Since these backends are usually slower than a dedicated cache store, consider putting it behind a
 * {@link TieredCache} with an in-memory first tier.
 *
 * @see https://github.com/Guichaguri/cachimbo/blob/HEAD/docs/stores/keyv.md
 */
export class KeyvCache extends BaseCache {
  protected readonly keyv: Keyv;

  constructor(options: KeyvCacheOptions) {
    super(options);
    this.keyv = options.keyv;
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.keyv.get<T>(key);
  }

  async set<T>(key: string, value: T, options: SetCacheOptions = {}): Promise<void> {
    await this.keyv.set(key, value, options.ttl ? options.ttl * 1000 : undefined);
  }

  async delete(key: string): Promise<void> {
    await this.keyv.delete(key);
  }

  override async getMany<T>(keys: string[]): Promise<Record<string, T>> {
    const data = await this.keyv.getMany<T>(keys);
    const result: Record<string, T> = Object.create(null);

    for (let i = 0; i < keys.length; i++) {
      const value = data[i];

      if (value !== undefined) {
        result[keys[i]] = value;
      }
    }

    return result;
  }

  override async setMany<T>(data: Record<string, T>, options: SetCacheOptions = {}): Promise<void> {
    const ttl = options.ttl ? options.ttl * 1000 : undefined;

    await this.keyv.setMany(
      Object.entries(data).map(([key, value]) => ({
        key,
        value,
        ttl,
      })),
    );
  }

  override async deleteMany(keys: string[]): Promise<void> {
    await this.keyv.deleteMany(keys);
  }
}
