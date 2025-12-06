import type { RedisClientType, RedisClientPoolType, RedisClusterType, RedisSentinelType } from '@redis/client';
import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';
import { BaseCache } from '../../base/index.js';

type Redis = RedisClientType | RedisClientPoolType | RedisClusterType | RedisSentinelType;

export interface RedisCacheOptions extends BaseCacheOptions {
  /**
   * The Redis client
   */
  client: RedisClientType | RedisClientPoolType | RedisClusterType | RedisSentinelType;

  /**
   * The default Time To Live in seconds
   */
  defaultTTL?: number;

  /**
   * Indicates whether the Redis server supports MSETEX command.
   *
   * {@link RedisCache#setMany} will use MSETEX if this option is set to `true`.
   *
   * This option should be set to `true` if the server runs Redis OSS 8.4.0 or above.
   * Valkey does not support this yet. (see https://github.com/valkey-io/valkey/issues/2592)
   */
  isMSETEXSupported?: boolean;
}

/**
 * A Redis cache implementation using node-redis
 */
export class RedisCache extends BaseCache {
  protected readonly client: Redis;
  protected defaultTTL?: number;
  protected isMSETEXSupported?: boolean;

  constructor(options: RedisCacheOptions) {
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

    await this.client.set(
      key,
      JSON.stringify(value),
      { expiration: ttl ? { type: 'EX', value: ttl } : undefined },
    );
  }

  async delete(key: string): Promise<void> {
    this.logger?.debug(this.name, '[delete] Running "DEL" command...', 'key =', key);

    await this.client.del(key);
  }

  override async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    this.logger?.debug(this.name, '[getMany] Running "MGET" command...', 'keys =', keys);

    const values = await this.client.mGet(keys);

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

    const raw: [string, string][] = [];
    const ttl = options?.ttl ?? this.defaultTTL;

    for (const [key, value] of Object.entries(data)) {
      raw.push([key, JSON.stringify(value)]);
    }

    await this.client.mSetEx(
      raw,
      { expiration: ttl ? { type: 'EX', value: ttl } : undefined },
    );
  }

  override async deleteMany(keys: string[]): Promise<void> {
    this.logger?.debug(this.name, '[deleteMany] Running "DEL" command...', 'keys =', keys);

    await this.client.del(keys);
  }

}
