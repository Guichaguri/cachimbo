import type { KVNamespace } from '@cloudflare/workers-types';
import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';
import { BaseCache } from '../../base/index.js';

export interface WorkersKVCacheOptions extends BaseCacheOptions {
  /**
   * The KV namespace (`env.NAMESPACE`)
   */
  kv: KVNamespace;
}

/**
 * A CloudFlare Workers KV cache implementation.
 */
export class WorkersKVCache extends BaseCache {
  protected readonly kv: KVNamespace;

  constructor(options: WorkersKVCacheOptions) {
    super(options);
    this.kv = options.kv;
  }

  get<T>(key: string): Promise<T | null> {
    return this.kv.get<T>(key, { type: 'json' });
  }

  set<T>(key: string, value: T, options: SetCacheOptions = {}): Promise<void> {
    return this.kv.put(key, JSON.stringify(value), { expirationTtl: options.ttl });
  }

  delete(key: string): Promise<void> {
    return this.kv.delete(key);
  }

  override async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    const data = await this.kv.get<T>(keys, { type: 'json' });

    return Object.fromEntries(data);
  }

}
