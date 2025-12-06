import type { Redis } from 'ioredis';
import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';
import { BaseCache } from '../../base/index.js';

export interface IORedisCacheOptions extends BaseCacheOptions {
  /**
   * The ioredis client
   */
  client: Redis;

  /**
   * The default Time To Live in seconds
   */
  defaultTTL?: number;

  /**
   * Indicates whether the Redis server supports MSETEX command.
   *
   * {@link IORedisCache#setMany} will use MSETEX if this option is set to `true`.
   *
   * This option should be set to `true` if the server runs Redis OSS 8.4.0 or above.
   * Valkey does not support this yet. (see https://github.com/valkey-io/valkey/issues/2592)
   */
  isMSETEXSupported?: boolean;
}

/**
 * A Redis cache implementation using ioredis
 */
export class IORedisCache extends BaseCache {
  protected readonly client: Redis;
  protected defaultTTL?: number;
  protected isMSETEXSupported?: boolean;

  constructor(options: IORedisCacheOptions) {
    super(options);
    this.client = options.client;
    this.defaultTTL = options.defaultTTL;
    this.isMSETEXSupported = options.isMSETEXSupported;
  }

  async get<T>(key: string): Promise<T | null> {
    this.logger?.debug(this.name, '[get] Running "GET" command...', 'key =', key);

    const raw = await this.client.get(key);

    return raw ? JSON.parse(raw) : null;
  }

  async set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    this.logger?.debug(this.name, '[set] Running "SET" command...', 'key =', key);

    const ttl = options?.ttl ?? this.defaultTTL;
    const raw = JSON.stringify(value);

    if (ttl) {
      await this.client.set(key, raw, 'EX', ttl);
    } else {
      await this.client.set(key, raw);
    }
  }

  async delete(key: string): Promise<void> {
    this.logger?.debug(this.name, '[delete] Running "DEL" command...', 'key =', key);

    await this.client.del(key);
  }

  override async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    this.logger?.debug(this.name, '[getMany] Running "MGET" command...', 'keys =', keys);

    const values = await this.client.mget(keys);

    const data: Record<string, T | null> = {};

    for (let i = 0; i < keys.length; i++) {
      const value = values[i];

      data[keys[i]!] = value ? JSON.parse(value) : null;
    }

    return data;
  }

  override async setMany(data: Record<string, any>, options?: SetCacheOptions): Promise<void> {
    if (!this.isMSETEXSupported) {
      return super.setMany(data, options);
    }

    this.logger?.debug(this.name, '[setMany] Running "MSETEX" command...', 'data =', data);

    const entries = Object.entries(data);
    const ttl = options?.ttl ?? this.defaultTTL;

    const raw = entries.flatMap(([key, value]) => [
      key,
      JSON.stringify(value),
    ]);

    await this.client.call('MSETEX', entries.length, ...raw, ...(ttl ? ['EX', ttl] : []));
  }

  override async deleteMany(keys: string[]): Promise<void> {
    this.logger?.debug(this.name, '[deleteMany] Running "DEL" command...', 'keys =', keys);

    await this.client.del(keys);
  }

}
