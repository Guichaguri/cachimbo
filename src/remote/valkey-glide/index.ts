import { BaseCache } from '../../base/index.js';
import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';
import type { BaseClient, GlideClient, GlideClusterClient } from '@valkey/valkey-glide';

export interface ValkeyGlideCacheOptions extends BaseCacheOptions {
  /**
   * The GLIDE client instance
   */
  client: GlideClient | GlideClusterClient | BaseClient;

  /**
   * The default Time To Live in seconds
   */
  defaultTTL?: number;
}

/**
 * A Valkey or Redis cache store using the GLIDE client (`@valkey/valkey-glide`).
 *
 * The client has to be created by your application, this class only issues commands.
 * Values are stored JSON-serialized, so they **must** be JSON stringifiable.
 *
 * Batch reads use `MGET` and batch deletions use `UNLINK`, while batch writes run individual `SET` commands.
 *
 * @see https://github.com/Guichaguri/cachimbo/blob/HEAD/docs/stores/redis-valkey.md
 */
export class ValkeyGlideCache extends BaseCache {
  protected readonly client: BaseClient;
  protected defaultTTL?: number;

  constructor(options: ValkeyGlideCacheOptions) {
    super(options);
    this.client = options.client;
    this.defaultTTL = options.defaultTTL;
  }

  async get<T>(key: string): Promise<T | undefined> {
    this.logger?.debug(this.name, '[get] Running "GET" command...', 'key =', key);

    const raw = await this.client.get(key);

    return raw ? JSON.parse(raw.toString()) : undefined;
  }

  async set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    this.logger?.debug(this.name, '[set] Running "SET" command...', 'key =', key);

    const ttl = options?.ttl ?? this.defaultTTL;

    await this.client.set(
      key,
      JSON.stringify(value),
      { expiry: ttl ? { type: 'EX' as any, count: ttl } : undefined },
    );
  }

  async delete(key: string): Promise<void> {
    this.logger?.debug(this.name, '[delete] Running "UNLINK" command...', 'key =', key);

    await this.client.unlink([key]);
  }

  override async getMany<T>(keys: string[]): Promise<Record<string, T>> {
    if (keys.length === 0) {
      return {};
    }

    this.logger?.debug(this.name, '[getMany] Running "MGET" command...', 'keys =', keys);

    const values = await this.client.mget(keys);

    const data: Record<string, T> = Object.create(null);

    for (let i = 0; i < keys.length; i++) {
      const value = values[i];

      if (value) {
        data[keys[i]!] = JSON.parse(value.toString());
      }
    }

    return data;
  }

  override async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    this.logger?.debug(this.name, '[deleteMany] Running "UNLINK" command...', 'keys =', keys);

    await this.client.unlink(keys);
  }

}
