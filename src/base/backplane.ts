import type { BaseCacheOptions, ICache, SetCacheOptions } from '../types/cache.js';
import type { BaseLocalCache } from './local.js';
import type { Logger } from '../types/logger.js';

export type BackplaneEvent = {
  action: 'set',
  key: string,
  data: any,
  options?: SetCacheOptions,
} | {
  action: 'delete',
  key: string,
} | {
  action: 'setMany',
  data: Record<string, any>;
  options?: SetCacheOptions,
} | {
  action: 'deleteMany',
  keys: string[],
};

export interface BaseBackplaneOptions extends BaseCacheOptions {
  /**
   * The underlying cache.
   * It should only be used with local caches since it does not propagate changes automatically.
   */
  cache: BaseLocalCache;

  /**
   * The mode in which the backplane will publish updates.
   *
   * **Active**: publishes the payload of the updated cache entry to other nodes.
   * This allows other nodes to update their cache with the new value without having to fetch it from origin.
   * This is the default mode.
   *
   * **Lazy**: only publishes the keys of the updated cache entry to other nodes.
   * This forces other nodes to invalidate their cache and fetch the new value from origin on the next request.
   * This mode can be used to reduce network traffic at the cost of potentially higher latency for cache updates.
   */
  mode?: 'active' | 'lazy';
}

export abstract class BaseBackplane implements ICache {
  protected readonly cache: BaseLocalCache;
  protected readonly mode: 'active' | 'lazy';
  protected readonly logger?: Logger;
  protected readonly name?: string;

  constructor(options: BaseBackplaneOptions) {
    this.cache = options.cache;
    this.mode = options.mode || 'active';
    this.logger = options.logger;
    this.name = options.name;
  }

  get<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(key);
  }

  getOrLoad<T>(key: string, load: () => Promise<T>, options?: SetCacheOptions): Promise<T> {
    const loadWrapped = async (): Promise<T> => {
      const data = await load();

      if (this.mode === 'active') {
        await this.emit({ action: 'set', key, data, options });
      } else {
        await this.emit({ action: 'delete', key });
      }

      return data;
    };

    return this.cache.getOrLoad(key, loadWrapped, options);
  }

  async set<T>(key: string, data: T, options?: SetCacheOptions): Promise<void> {
    await this.cache.set<T>(key, data, options);

    if (this.mode === 'active') {
      await this.emit({ action: 'set', key, data, options });
    } else {
      await this.emit({ action: 'delete', key });
    }
  }

  async delete(key: string): Promise<void> {
    await this.cache.delete(key);
    await this.emit({ action: 'delete', key });
  }

  getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    return this.cache.getMany<T>(keys);
  }

  async setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void> {
    await this.cache.setMany<T>(data, options);

    if (this.mode === 'active') {
      await this.emit({ action: 'setMany', data, options });
    } else {
      await this.emit({ action: 'deleteMany', keys: Object.keys(data) });
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    await this.cache.deleteMany(keys);
    await this.emit({ action: 'deleteMany', keys });
  }

  /**
   * Processes backplane events received from other nodes
   *
   * @param event The event data
   */
  protected async receiveEvent(event: BackplaneEvent): Promise<void> {
    try {
      switch (event.action) {
        case "set":
          return await this.cache.set(event.key, event.data, event.options);
        case "delete":
          return await this.cache.delete(event.key);
        case "setMany":
          return await this.cache.setMany(event.data, event.options);
        case "deleteMany":
          return await this.cache.deleteMany(event.keys);
        default:
          this.logger?.debug(this.name, '[receiveEvent] Unknown event received.', 'event = ', event);
      }
    } catch (error) {
      this.logger?.debug(this.name, '[receiveEvent] Error processing received event.',
        'event = ', event, 'error = ', error);
    }
  }

  /**
   * Emits an event to other backplane nodes
   *
   * @param data The event data
   */
  protected abstract emit(data: BackplaneEvent): Promise<void>;

  /**
   * Unsubscribes from backplane events and cleans up resources
   */
  abstract dispose(): void;
}
