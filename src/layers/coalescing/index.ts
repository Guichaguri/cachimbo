import type { BaseCacheOptions, ICache, LoadContext, SetCacheOptions } from '../../types/cache.js';
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
  promise: Promise<any | undefined>;
  type: 'get' | 'getOrLoad';
}

/**
 * A cache layer that deduplicates parallel requests for the same key into a single one.
 *
 * While a request for a key is in flight, any other request for that key awaits the same promise
 * instead of reaching the underlying cache again. This prevents the Thundering Herd problem from
 * hitting both the cache store and the origin.
 *
 * Writes and deletions also update the in-flight entry, so a concurrent read never returns a value
 * that was just replaced.
 *
 * Deduplication happens in-process and per instance, so it does not coordinate between
 * application instances.
 *
 * @see https://github.com/Guichaguri/cachimbo/blob/HEAD/docs/layers/request-coalescing.md
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

  get<T>(key: string): Promise<T | undefined> {
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

  async getOrLoad<T>(key: string, load: (ctx: LoadContext) => Promise<T>, options?: SetCacheOptions): Promise<T> {
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
    if (request !== undefined || ongoingRequest.type === 'getOrLoad') {
      this.logger?.debug(this.name, '[getOrLoad] Read from an ongoing request.', 'key =', key);

      return request;
    }

    this.logger?.debug(this.name, '[getOrLoad] Refreshing the cache...', 'key =', key);

    const context: LoadContext = { options: options ? { ...options } : {} };

    // Otherwise, we'll load it manually
    const promise = load(context);

    this.ongoingRequests.set(key, { promise, type: 'getOrLoad' });

    try {
      request = await promise;

      // When the request is successful, we'll store it in cache
      if (request !== undefined) {
        await this.cache.set(key, request, context.options);
      }
    } finally {
      // We'll only delete from "ongoing requests" when we finish saving it
      this.ongoingRequests.delete(key);
    }

    return request;
  }

  async set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    this.logger?.debug(this.name, '[set]', 'key =', key);

    const promise = this.cache.set<T>(key, value, options);

    this.ongoingRequests.set(key, {
      promise: this.share(promise.then(() => value)),
      type: 'getOrLoad',
    });

    await promise.finally(() => this.ongoingRequests.delete(key));
  }

  async delete(key: string): Promise<void> {
    this.logger?.debug(this.name, '[delete]', 'key =', key);

    try {
      this.ongoingRequests.set(key, {
        type: 'get',
        promise: Promise.resolve(undefined),
      });

      await this.cache.delete(key);
    } finally {
      this.ongoingRequests.delete(key);
    }
  }

  async getMany<T>(keys: string[]): Promise<Record<string, T>> {
    const items: [string, Promise<T | undefined>][] = [];
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
          .then(data => data[key])
          .finally(() => this.ongoingRequests.delete(key));

        this.ongoingRequests.set(key, {
          promise: itemPromise,
          type: 'get',
        });

        items.push([key, itemPromise]);
      }
    }

    const data: Record<string, T> = Object.create(null);

    await Promise.all(
      items.map(async ([key, promise]) => {
        const value = await promise;

        if (value !== undefined) {
          data[key] = value;
        }
      }),
    );

    return data;
  }

  async setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void> {
    this.logger?.debug(this.name, '[setMany]', 'data =', data);

    const promise = this.cache.setMany(data, options);

    for (const [key, value] of Object.entries(data)) {
      this.ongoingRequests.set(key, {
        promise: this.share(promise.then(() => value).finally(() => this.ongoingRequests.delete(key))),
        type: 'getOrLoad',
      });
    }

    await promise;
  }

  /**
   * Marks a promise that is only stored as an ongoing request as handled.
   *
   * Nothing is guaranteed to read these entries, so a rejection would otherwise
   * bubble up as an unhandled rejection and crash the process.
   * The rejection is still forwarded to whoever awaits the returned promise.
   *
   * @param promise The promise to share between the ongoing requests
   */
  protected share<T>(promise: Promise<T>): Promise<T> {
    promise.catch(() => undefined);

    return promise;
  }

  async deleteMany(keys: string[]): Promise<void> {
    this.logger?.debug(this.name, '[deleteMany]', 'keys =', keys);

    try {
      for (const key of keys) {
        this.ongoingRequests.set(key, {
          type: 'get',
          promise: Promise.resolve(undefined),
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
