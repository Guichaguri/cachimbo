import type { KVNamespace } from '@cloudflare/workers-types';
import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';
import { BaseCache } from '../../base/index.js';

export interface WorkersKVCacheOptions extends BaseCacheOptions {
  /**
   * The KV namespace (`env.NAMESPACE`)
   */
  kv: KVNamespace;

  /**
   * The amount of time in seconds that a KV result is cached in the global network location it is accessed from.
   *
   * Increasing this value can improve read performance at the cost of data being stale.
   *
   * @see https://developers.cloudflare.com/kv/api/read-key-value-pairs/#cachettl-parameter
   */
  edgeCacheTTL?: number;
}

/**
 * A Cloudflare Workers KV cache implementation.
 */
export class WorkersKVCache extends BaseCache {
  protected readonly kv: KVNamespace;
  protected edgeCacheTTL?: number;

  constructor(options: WorkersKVCacheOptions) {
    super(options);
    this.kv = options.kv;
    this.edgeCacheTTL = options.edgeCacheTTL;
  }

  get<T>(key: string): Promise<T | null> {
    return this.kv.get<T>(key, { type: 'json', cacheTtl: this.edgeCacheTTL });
  }

  set<T>(key: string, value: T, options: SetCacheOptions = {}): Promise<void> {
    return this.kv.put(key, JSON.stringify(value), { expirationTtl: options.ttl });
  }

  delete(key: string): Promise<void> {
    return this.kv.delete(key);
  }

  override async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    const data = await this.kv.get<T>(keys, { type: 'json', cacheTtl: this.edgeCacheTTL });

    return Object.fromEntries(data);
  }

}
