import type { BaseCacheOptions, ICache, SetCacheOptions } from '../../types/cache.js';
import type { Logger } from '../../types/logger.js';

export interface MetricsCollectingCacheOptions extends BaseCacheOptions {
  /**
   * The underlying cache
   */
  cache: ICache;
}

export interface CacheMetrics {
  /**
   * Amount of times the cache didn't have the requested resource
   */
  miss: number;

  /**
   * The amount of times the cache returned the requested resource
   */
  hit: number;

  /**
   * The amount of times the cache was refreshed (the `load` function was called in {@link ICache#getOrLoad})
   */
  load: number;

  /**
   * The amount of times the cache was updated
   */
  set: number;

  /**
   * The amount of times a cached resource was invalidated
   */
  delete: number;
}

/**
 * A cache layer that collects metrics from each cache call.
 *
 * This can be useful to measure the cache effectiveness
 */
export class MetricsCollectingCache implements ICache {
  protected readonly cache: ICache;
  protected readonly logger?: Logger;
  protected name?: string;

  protected _metrics: CacheMetrics = {
    miss: 0,
    hit: 0,
    load: 0,
    set: 0,
    delete: 0,
  };

  constructor(options: MetricsCollectingCacheOptions) {
    this.cache = options.cache;
    this.logger = options.logger;
    this.name = options.name;
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.cache.get<T>(key);

    if (data === null) {
      this._metrics.miss++;

      this.logger?.debug(this.name, '[get] Cache miss.', 'key =', key);
    } else {
      this._metrics.hit++;

      this.logger?.debug(this.name, '[get] Cache hit.', 'key =', key);
    }

    return data;
  }

  async getOrLoad<T>(key: string, load: () => Promise<T>, options?: SetCacheOptions): Promise<T> {
    let didTriggerLoad: boolean = false;

    const loadMiddleware = (): Promise<T> => {
      this._metrics.miss++;
      this._metrics.load++;
      this._metrics.set++;
      didTriggerLoad = true;

      this.logger?.debug(this.name, '[getOrLoad] Cache refresh.', 'key =', key);

      return load();
    };

    const data = await this.cache.getOrLoad<T>(key, loadMiddleware, options);

    if (!didTriggerLoad) {
      this._metrics.hit++;

      this.logger?.debug(this.name, '[getOrLoad] Cache hit.', 'key =', key);
    }

    return data;
  }

  async set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    await this.cache.set(key, value, options);

    this._metrics.set++;

    this.logger?.debug(this.name, '[set] Cache set.', 'key =', key);
  }

  async delete(key: string): Promise<void> {
    await this.cache.delete(key);

    this._metrics.delete++;

    this.logger?.debug(this.name, '[delete] Cache delete.', 'key =', key);
  }

  async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    const data = await this.cache.getMany<T>(keys);

    const miss = keys.filter(key => data[key] === undefined || data[key] === null).length;
    const hits = keys.length - miss;

    this._metrics.miss += miss;
    this._metrics.hit += hits;

    this.logger?.debug(this.name, '[getMany]', 'hits =', hits, 'misses = ', miss);

    return data;
  }

  async setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void> {
    await this.cache.setMany(data, options);

    const sets = Object.keys(data).length;

    this._metrics.set += sets;

    this.logger?.debug(this.name, '[setMany]', 'sets =', sets);
  }

  async deleteMany(keys: string[]): Promise<void> {
    await this.cache.deleteMany(keys);

    this._metrics.delete += keys.length;

    this.logger?.debug(this.name, '[deleteMany]', 'deletes =', keys.length);
  }

  get metrics() {
    return this._metrics;
  }

  resetMetrics(): void {
    this._metrics = {
      miss: 0,
      hit: 0,
      load: 0,
      set: 0,
      delete: 0,
    };

    this.logger?.debug(this.name, '[resetMetrics]');
  }

}
