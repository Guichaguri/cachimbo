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
 * A Cloudflare Workers KV cache store, designed for the Workers binding API (`env.YOUR_NAMESPACE`).
 *
 * Values are stored JSON-serialized, so they **must** be JSON stringifiable.
 *
 * KV is eventually consistent: a value that was just written may not be visible to the next read,
 * which is worth keeping in mind when invalidating entries. It also rejects TTLs shorter than 60 seconds.
 *
 * @see https://github.com/Guichaguri/cachimbo/blob/HEAD/docs/stores/cloudflare-workers-kv.md
 * @see https://developers.cloudflare.com/kv/concepts/how-kv-works/
 */
export class WorkersKVCache extends BaseCache {
  protected readonly kv: KVNamespace;
  protected edgeCacheTTL?: number;

  constructor(options: WorkersKVCacheOptions) {
    super(options);
    this.kv = options.kv;
    this.edgeCacheTTL = options.edgeCacheTTL;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.kv.get<T>(key, { type: 'json', cacheTtl: this.edgeCacheTTL });

    return value === null ? undefined : value;
  }

  set<T>(key: string, value: T, options: SetCacheOptions = {}): Promise<void> {
    return this.kv.put(key, JSON.stringify(value), { expirationTtl: options.ttl });
  }

  delete(key: string): Promise<void> {
    return this.kv.delete(key);
  }

  override async getMany<T>(keys: string[]): Promise<Record<string, T>> {
    const values = await this.kv.get<T>(keys, { type: 'json', cacheTtl: this.edgeCacheTTL });
    const data: Record<string, T> = Object.create(null);

    for (const [key, value] of values) {
      if (value !== null) {
        data[key] = value;
      }
    }

    return data;
  }

}
