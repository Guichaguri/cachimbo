import type { BaseCacheOptions, ICache, SetCacheOptions } from '../../types/cache.js';
import type { Logger } from '../../types/logger.js';

export interface MetricsCollectingCacheOptions extends BaseCacheOptions {
  /**
   * The underlying cache
   */
  cache: ICache;
}

interface CacheCountMetrics {
  /** Amount of times the cache didn't have the requested resource */
  missCount: number;

  /** The amount of times the cache returned the requested resource */
  hitCount: number;

  /** The amount of times the cache was refreshed (the `load` function was called in {@link ICache#getOrLoad}) */
  loadCount: number;

  /** The amount of times the cache was updated */
  setCount: number;

  /** The amount of times a cached resource was invalidated */
  deleteCount: number;
}

interface CacheTimeMetrics {
  /** Average time taken to verify that the cache didn't have a single requested resource (in milliseconds) */
  missTime: number;

  /** Average time taken to return a single requested resource from cache (in milliseconds) */
  hitTime: number;

  /** Average time taken to load a single resource from source (in milliseconds) */
  loadTime: number;

  /** Average time taken to update a single resource from cache (in milliseconds) */
  setTime: number;

  /** Average time taken to invalidate a single resource from cache (in milliseconds) */
  deleteTime: number;
}

export type CacheMetrics = CacheCountMetrics & CacheTimeMetrics;

/**
 * A cache layer that collects metrics from each cache call.
 *
 * This can be useful to measure the cache effectiveness
 */
export class MetricsCollectingCache implements ICache {
  protected readonly cache: ICache;
  protected readonly logger?: Logger;
  protected name?: string;

  protected countMetrics: CacheCountMetrics = {
    missCount: 0,
    hitCount: 0,
    loadCount: 0,
    setCount: 0,
    deleteCount: 0,
  };
  protected totalTimeMetrics: CacheTimeMetrics = {
    missTime: 0,
    hitTime: 0,
    loadTime: 0,
    setTime: 0,
    deleteTime: 0,
  };

  constructor(options: MetricsCollectingCacheOptions) {
    this.cache = options.cache;
    this.logger = options.logger;
    this.name = options.name;
  }

  async get<T>(key: string): Promise<T | null> {
    const startAt = performance.now();

    const data = await this.cache.get<T>(key);

    const time = performance.now() - startAt;

    if (data === null) {
      this.countMetrics.missCount++;
      this.totalTimeMetrics.missTime += time;

      this.logger?.debug(this.name, '[get] Cache miss.', 'key =', key, 'timeMS =', time);
    } else {
      this.countMetrics.hitCount++;
      this.totalTimeMetrics.hitTime += time;

      this.logger?.debug(this.name, '[get] Cache hit.', 'key =', key, 'timeMS =', time);
    }

    return data;
  }

  async getOrLoad<T>(key: string, load: () => Promise<T>, options?: SetCacheOptions): Promise<T> {
    let didTriggerLoad: boolean = false;
    let loadFinishAt: number = 0;

    const loadMiddleware = (): Promise<T> => {
      const missFinishAt = performance.now();

      this.countMetrics.missCount++;
      this.totalTimeMetrics.missTime += missFinishAt - startAt;

      didTriggerLoad = true;

      this.logger?.debug(this.name, '[getOrLoad] Cache refresh.', 'key =', key);

      const loadStartAt = performance.now();

      return load().finally(() => {
        loadFinishAt = performance.now();

        this.countMetrics.loadCount++;
        this.totalTimeMetrics.loadTime += loadFinishAt - loadStartAt;
      });
    };

    let startAt = performance.now();

    const data = await this.cache.getOrLoad<T>(key, loadMiddleware, options);

    if (!didTriggerLoad) {
      const hitFinishedAt = performance.now();

      this.countMetrics.hitCount++;
      this.totalTimeMetrics.hitTime += hitFinishedAt - startAt;

      this.logger?.debug(this.name, '[getOrLoad] Cache hit.', 'key =', key);
    } else {
      const setFinishAt = performance.now();

      this.countMetrics.setCount++;
      this.totalTimeMetrics.setTime += setFinishAt - loadFinishAt;
    }

    return data;
  }

  async set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    const startAt = performance.now();

    await this.cache.set(key, value, options);

    const time = performance.now() - startAt;

    this.countMetrics.setCount++;
    this.totalTimeMetrics.setTime += time;

    this.logger?.debug(this.name, '[set] Cache set.', 'key =', key, 'timeMS =', time);
  }

  async delete(key: string): Promise<void> {
    const startAt = performance.now();

    await this.cache.delete(key);

    const time = performance.now() - startAt;

    this.countMetrics.deleteCount++;
    this.totalTimeMetrics.deleteTime += time;

    this.logger?.debug(this.name, '[delete] Cache delete.', 'key =', key, 'timeMS =', time);
  }

  async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    const startAt = performance.now();

    const data = await this.cache.getMany<T>(keys);

    const time = performance.now() - startAt;
    const timePerKey = time / keys.length;

    const miss = keys.filter(key => data[key] === undefined || data[key] === null).length;
    const hits = keys.length - miss;

    this.countMetrics.missCount += miss;
    this.countMetrics.hitCount += hits;
    this.totalTimeMetrics.missTime += miss * timePerKey;
    this.totalTimeMetrics.hitTime += hits * timePerKey;

    this.logger?.debug(this.name, '[getMany]', 'hits =', hits, 'misses = ', miss, 'timeMS =', time);

    return data;
  }

  async setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void> {
    const startAt = performance.now();

    await this.cache.setMany(data, options);

    const time = performance.now() - startAt;

    const sets = Object.keys(data).length;

    this.countMetrics.setCount += sets;
    this.totalTimeMetrics.setTime += time;

    this.logger?.debug(this.name, '[setMany]', 'sets =', sets, 'timeMS =', time);
  }

  async deleteMany(keys: string[]): Promise<void> {
    const startAt = performance.now();

    await this.cache.deleteMany(keys);

    const time = performance.now() - startAt;

    this.countMetrics.deleteCount += keys.length;
    this.totalTimeMetrics.deleteTime += time;

    this.logger?.debug(this.name, '[deleteMany]', 'deletes =', keys.length, 'timeMS =', time);
  }

  getMetrics(): CacheMetrics {
    const count = this.countMetrics;
    const time = this.totalTimeMetrics;

    return {
      ...count,
      missTime: count.missCount === 0 ? 0 : time.missTime / count.missCount,
      hitTime: count.hitCount === 0 ? 0 : time.hitTime / count.hitCount,
      loadTime: count.loadCount === 0 ? 0 : time.loadTime / count.loadCount,
      setTime: count.setCount === 0 ? 0 : time.setTime / count.setCount,
      deleteTime: count.deleteCount === 0 ? 0 : time.deleteTime / count.deleteCount,
    };
  }

  resetMetrics(): void {
    this.countMetrics = {
      missCount: 0,
      hitCount: 0,
      loadCount: 0,
      setCount: 0,
      deleteCount: 0,
    };
    this.totalTimeMetrics = {
      missTime: 0,
      hitTime: 0,
      loadTime: 0,
      setTime: 0,
      deleteTime: 0,
    };

    this.logger?.debug(this.name, '[resetMetrics]');
  }

}
