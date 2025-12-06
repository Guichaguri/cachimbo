import type { BaseCacheOptions, ICache, SetCacheOptions } from '../../types/cache.d.ts';
import type { Logger } from '../../types/logger.js';

/**
 * The options to construct the {@link CoalescingCache}
 */
export interface CoalescingCacheOptions extends BaseCacheOptions {
  /**
   * The underlying cache
   */
  cache: ICache;
}

interface OngoingRequest {
  promise: Promise<any | null>;
  type: 'get' | 'getOrLoad';
}

/**
 * A cache strategy layer that deduplicates parallel requests into a single request.
 *
 * This strategy can prevent the Thundering Herd problem as all parallel requests will be coalesced into one.
 */
export class CoalescingCache implements ICache {
  protected readonly ongoingRequests: Map<string, OngoingRequest> = new Map();
  protected readonly cache: ICache;
  protected readonly name?: string;
  protected readonly logger?: Logger;

  constructor(options: CoalescingCacheOptions) {
    this.cache = options.cache;
    this.name = options.name;
    this.logger = options.logger;
  }

  get<T>(key: string): Promise<T | null> {
    const ongoingRequest = this.ongoingRequests.get(key);

    if (ongoingRequest) {
      this.logger?.debug(this.name, '[get] Returning ongoing request...', 'key =', key);

      return ongoingRequest.promise;
    }

    this.logger?.debug(this.name, '[get] Reading from underlying cache...', 'key =', key);

    const promise = this.cache.get<T>(key);

    this.ongoingRequests.set(key, { promise, type: 'get' });

    return promise.finally(() => this.ongoingRequests.delete(key));
  }

  async getOrLoad<T>(key: string, load: () => Promise<T>, options?: SetCacheOptions): Promise<T> {
    const ongoingRequest = this.ongoingRequests.get(key);

    // When there's no ongoing requests, we'll do a new one
    if (!ongoingRequest) {
      this.logger?.debug(this.name, '[getOrLoad] Reading from the underlying cache...', 'key =', key);

      const promise = this.cache.getOrLoad(key, load, options);

      this.ongoingRequests.set(key, { promise, type: 'getOrLoad' });

      return promise.finally(() => this.ongoingRequests.delete(key));
    }

    // We'll await the ongoing request
    let request = await ongoingRequest.promise;

    // When the request is successful or the type is already getOrLoad, we'll just return it
    if (request !== null || ongoingRequest.type === 'getOrLoad') {
      this.logger?.debug(this.name, '[getOrLoad] Read from an ongoing request.', 'key =', key);

      return request;
    }

    this.logger?.debug(this.name, '[getOrLoad] Refreshing the cache...', 'key =', key);

    // Otherwise, we'll load it manually
    const promise = load();

    this.ongoingRequests.set(key, { promise, type: 'getOrLoad' });

    try {
      request = await promise;

      // When the request is successful, we'll store it in cache
      if (request !== null) {
        await this.cache.set(key, request, options);
      }
    } finally {
      // We'll only delete from "ongoing requests" when we finish saving it
      this.ongoingRequests.delete(key);
    }

    return request;
  }

  set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    this.logger?.debug(this.name, '[set]', 'key =', key);

    const promise = this.cache.set<T>(key, value, options);

    this.ongoingRequests.set(key, {
      promise: promise.then(() => value),
      type: 'getOrLoad',
    });

    return promise.finally(() => this.ongoingRequests.delete(key));
  }

  async delete(key: string): Promise<void> {
    this.logger?.debug(this.name, '[delete]', 'key =', key);

    try {
      this.ongoingRequests.set(key, {
        type: 'get',
        promise: Promise.resolve(null),
      });

      await this.cache.delete(key);
    } finally {
      this.ongoingRequests.delete(key);
    }
  }

  async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    const items: [string, Promise<T | null>][] = [];
    const remainingKeys: string[] = [];

    for (const key of keys) {
      const ongoingRequest = this.ongoingRequests.get(key);

      if (ongoingRequest) {
        items.push([key, ongoingRequest.promise]);
      } else {
        remainingKeys.push(key);
      }
    }

    this.logger?.debug(this.name, '[getMany]', items.length, 'ongoing requests found, reading', remainingKeys.length, 'resources.', 'keys =', keys);

    if (remainingKeys.length > 0) {
      const promise = this.cache.getMany<T>(remainingKeys);

      for (const key of remainingKeys) {
        const itemPromise = promise
          .then(data => data[key]!)
          .finally(() => this.ongoingRequests.delete(key));

        this.ongoingRequests.set(key, {
          promise: itemPromise,
          type: 'get',
        });

        items.push([key, itemPromise]);
      }
    }

    return Object.fromEntries(
      await Promise.all(
        items.map(async ([key, promise]) => [key, await promise])
      ),
    );
  }

  setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void> {
    this.logger?.debug(this.name, '[setMany]', 'data =', data);

    const promise = this.cache.setMany(data, options);

    for (const [key, value] of Object.entries(data)) {
      this.ongoingRequests.set(key, {
        promise: promise.then(() => value).finally(() => this.ongoingRequests.delete(key)),
        type: 'getOrLoad',
      });
    }

    return promise;
  }

  async deleteMany(keys: string[]): Promise<void> {
    this.logger?.debug(this.name, '[deleteMany]', 'keys =', keys);

    try {
      for (const key of keys) {
        this.ongoingRequests.set(key, {
          type: 'get',
          promise: Promise.resolve(null),
        });
      }

      await this.cache.deleteMany(keys);
    } finally {
      for (const key of keys) {
        this.ongoingRequests.delete(key);
      }
    }

  }

}
