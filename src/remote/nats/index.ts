import type { KV } from '@nats-io/kv';
import { BaseCache } from '../../base/index.js';
import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';

export interface NatsCacheOptions extends BaseCacheOptions {
  /**
   * The NATS KV instance
   *
   * @example
   * ```ts
   * import { connect } from '@nats-io/transport-node';
   * import { Kvm } from '@nats-io/kv';
   *
   * const nc = await connect({ servers: "demo.nats.io:4222" });
   * const kvm = new Kvm(nc);
   * const cacheKv = await kvm.create("mycache", {
   *   ttl: 20_000, // TTL of 20 seconds
   *   storage: 'memory', // if you don't need to persistence
   *   history: 0, // if you don't need history
   * });
   *
   * const cache = new NatsCache({ kv: cacheKv });
   * ```
   */
  kv: KV;

  /**
   * Whether it should completely delete the item instead of soft-deleting it.
   *
   * By default, the KV store adds a "DEL" marker to the entry, which indicates that the entry has been deleted.
   * This operation is faster than purging the entry, which completely deletes it from the KV store and removes all its history.
   * However, if you want to completely delete the entry and its history, you can set this option to `true`.
   *
   * This replaces the call made by {@link NatsCache#delete} from {@link KV#delete} to {@link KV#purge}.
   *
   * @default false
   */
  isHardDeleteEnabled?: boolean;
}

/**
 * A NATS cache using the Key/Value Store, which is built on top of JetStream.
 *
 * @remarks Per-item TTL is not supported.
 * @see https://docs.nats.io/nats-concepts/jetstream/key-value-store
 */
export class NatsCache extends BaseCache {
  protected readonly kv: KV;
  protected isHardDeleteEnabled: boolean;

  constructor(options: NatsCacheOptions) {
    super(options);
    this.kv = options.kv;
    this.isHardDeleteEnabled = options.isHardDeleteEnabled ?? false;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = await this.kv.get(key);

    return entry === null || entry.operation === 'DEL' || entry.operation === 'PURGE' ? null : entry.json<T>();
  }

  async set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    await this.kv.put(key, JSON.stringify(value));
  }

  delete(key: string): Promise<void> {
    if (this.isHardDeleteEnabled) {
      return this.kv.purge(key);
    } else {
      return this.kv.delete(key);
    }
  }
}
