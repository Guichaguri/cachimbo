import { BaseCache } from '../../base/index.js';
import type { BaseCacheOptions, ICache, SetCacheOptions } from '../../types/cache.js';

export interface TieredCacheOptions extends BaseCacheOptions {
  /**
   * The list of tiers in order of priority.
   *
   * The first item represents the "hot" cache while the last one represents a "cold" cache.
   */
  tiers: CacheTier[];
}

export interface CacheTier {
  /**
   * The underlying cache
   */
  cache: ICache;

  /**
   * The options that will be passed to {@link ICache#getOrLoad}, {@link ICache#set} and {@link ICache#setMany}.
   */
  options?: SetCacheOptions;
}

/**
 * A cache strategy layer that implements multi-level caching
 *
 * The objective of a tiered cache is to minimize latency while still having the benefits of a larger, shared cache.
 * This is done by having the first tier being an in-memory cache (such as {@link LocalTTLCache}) that stores a small amount of items with a short TTL,
 * and the second tier being an external cache (such as {@link RedisCache}) that stores a lot more items and may have a longer TTL.
 *
 * This strategy is similarly known as Cache Hierarchy, CPU cache or L1/L2/L3 cache.
 */
export class TieredCache extends BaseCache {
  protected readonly tiers: CacheTier[];

  constructor(options: TieredCacheOptions) {
    super(options);
    this.tiers = options.tiers;
  }

  async get<T>(key: string): Promise<T | null> {
    const next = (i: number): Promise<T | null> => {
      this.logger?.debug(this.name, '[get] Reading from tier =', i, 'key =', key);

      const tier = this.tiers[i]!;
      const isLastTier = i === this.tiers.length - 1;

      if (isLastTier) {
        return tier.cache.get<T>(key);
      }

      return tier.cache.getOrLoad(key, () => next(i + 1), tier.options);
    };

    return next(0);
  }

  override async getOrLoad<T>(key: string, load: () => Promise<T>, options?: SetCacheOptions): Promise<T> {
    const next = (i: number): Promise<T> => {
      this.logger?.debug(this.name, '[getOrLoad] Reading from tier =', i, 'key =', key);

      const tier = this.tiers[i]!;
      const isLastTier = i === this.tiers.length - 1;

      if (isLastTier) {
        return tier.cache.getOrLoad(key, load, options || tier.options);
      }

      return tier.cache.getOrLoad(key, () => next(i + 1), tier.options);
    };

    return next(0);
  }

  async set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    this.logger?.debug(this.name, '[set] Writing to all tiers in parallel...', 'key =', key);

    await Promise.all(
      this.tiers.map((tier, i) => {
        const isLastTier = i === this.tiers.length - 1;

        return tier.cache.set(key, value, isLastTier ? (options || tier.options) : tier.options);
      }),
    );
  }

  async delete(key: string): Promise<void> {
    this.logger?.debug(this.name, '[delete] Deleting from all tiers in parallel...', 'key =', key);

    await Promise.all(
      this.tiers.map(tier => tier.cache.delete(key)),
    );
  }

  override async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    // TODO backfilling

    const data: Record<string, T | null> = {};
    let remainingKeys: string[] = keys;

    for (let i = 0; i < this.tiers.length; i++) {
      this.logger?.debug(this.name, '[getMany] Reading from tier =', i, 'keys =', keys);

      const tier = this.tiers[i];
      const items = await tier.cache.getMany<T>(remainingKeys);

      remainingKeys = [];

      for (const [key, value] of Object.entries(items)) {
        if (value === null || value === undefined) {
          remainingKeys.push(key);
        } else {
          data[key] = value;
        }
      }

      if (remainingKeys.length === 0) {
        break;
      }
    }

    return data;
  }

  override async setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void> {
    this.logger?.debug(this.name, '[setMany] Writing to all tiers in parallel...', 'data =', data);

    await Promise.all(
      this.tiers.map((tier, i) => {
        const isLastTier = i === this.tiers.length - 1;

        return tier.cache.setMany(data, isLastTier ? (options || tier.options) : tier.options);
      }),
    );
  }

  override async deleteMany(keys: string[]): Promise<void> {
    this.logger?.debug(this.name, '[deleteMany] Deleting from all tiers in parallel...', 'keys =', keys);

    await Promise.all(
      this.tiers.map(tier => tier.cache.deleteMany(keys)),
    );
  }

}
