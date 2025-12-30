import type { IMap } from 'hazelcast-client';
import { BaseCache } from '../../base/index.js';
import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';

export interface HazelcastCacheOptions extends BaseCacheOptions {
  /**
   * Hazelcast map instance.
   *
   * Obtain it through a Hazelcast client:
   *
   * ```ts
   * import { Client } from 'hazelcast-client';
   *
   * const client = await Client.newHazelcastClient();
   * const map = await client.getMap('my-cache-map');
   *
   * const cache = new HazelcastCache({ map });
   * ```
   */
  map: IMap<string, any>;
}

/**
 * A Hazelcast cache implementation using an IMap
 */
export class HazelcastCache extends BaseCache {
  protected readonly map: IMap<string, any>;

  constructor(options: HazelcastCacheOptions) {
    super(options);
    this.map = options.map;
  }

  get<T>(key: string): Promise<T | null> {
    return this.map.get(key);
  }

  set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    return this.map.set(key, value, options?.ttl);
  }

  delete(key: string): Promise<void> {
    return this.map.delete(key);
  }

  override async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    const entries = await this.map.getAll(keys);
    const data: Record<string, T | null> = {};

    for (const [key, value] of entries) {
      data[key] = value;
    }

    return data;
  }
}
