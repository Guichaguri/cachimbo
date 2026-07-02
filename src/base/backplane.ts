import type { BaseCacheOptions, ICache, LoadContext, SetCacheOptions } from '../types/cache.js';
import type { BaseLocalCache } from './local.js';
import type { Logger } from '../types/logger.js';

export type BackplaneEvent = {
  action: 'set',
  key: string,
  data: any,
  options?: SetCacheOptions,
  nodeId?: string,
} | {
  action: 'delete',
  key: string,
  nodeId?: string,
} | {
  action: 'setMany',
  data: Record<string, any>;
  options?: SetCacheOptions,
  nodeId?: string,
} | {
  action: 'deleteMany',
  keys: string[],
  nodeId?: string,
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
  protected nodeId?: string;

  constructor(options: BaseBackplaneOptions) {
    this.cache = options.cache;
    this.mode = options.mode || 'active';
    this.logger = options.logger;
    this.name = options.name;
  }

  protected generateNodeId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return Math.random().toString(36).substring(2, 15);
  }

  get<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(key);
  }

  async getOrLoad<T>(key: string, load: (ctx: LoadContext) => Promise<T>, options?: SetCacheOptions): Promise<T> {
    let loaded = false;

    const loadWrapped = async (ctx: LoadContext): Promise<T> => {
      const result = await load(ctx);

      loaded = true;

      return result;
    };

    const data = await this.cache.getOrLoad(key, loadWrapped, options);

    if (loaded) {
      if (this.mode === 'active') {
        await this.emit({ action: 'set', key, data, options, nodeId: this.nodeId });
      } else {
        await this.emit({ action: 'delete', key, nodeId: this.nodeId });
      }
    }

    return data;
  }

  async set<T>(key: string, data: T, options?: SetCacheOptions): Promise<void> {
    await this.cache.set<T>(key, data, options);

    if (this.mode === 'active') {
      await this.emit({ action: 'set', key, data, options, nodeId: this.nodeId });
    } else {
      await this.emit({ action: 'delete', key, nodeId: this.nodeId });
    }
  }

  async delete(key: string): Promise<void> {
    await this.cache.delete(key);
    await this.emit({ action: 'delete', key, nodeId: this.nodeId });
  }

  getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    return this.cache.getMany<T>(keys);
  }

  async setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void> {
    await this.cache.setMany<T>(data, options);

    if (this.mode === 'active') {
      await this.emit({ action: 'setMany', data, options, nodeId: this.nodeId });
    } else {
      await this.emit({ action: 'deleteMany', keys: Object.keys(data), nodeId: this.nodeId });
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    await this.cache.deleteMany(keys);
    await this.emit({ action: 'deleteMany', keys, nodeId: this.nodeId });
  }

  /**
   * Processes backplane events received from other nodes
   *
   * @param event The event data
   */
  protected async receiveEvent(event: BackplaneEvent): Promise<void> {
    // In case the event came from this exact node, we don't need to process it again
    if (event.nodeId && event.nodeId === this.nodeId) {
      return;
    }

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
