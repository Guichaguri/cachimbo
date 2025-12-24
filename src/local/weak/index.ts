import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';
import { BaseLocalCache, type LocalCacheInternal } from '../../base/local.js';

export interface WeakCacheOptions extends BaseCacheOptions {
  /**
   * The underlying cache. This must be an in-memory cache.
   */
  cache: BaseLocalCache;
}

type WeakValue = { v: WeakRef<any>; w: true; } | { v: any; w: false; };

/**
 * A cache layer that stores objects as weak references.
 *
 * When an object is garbage collected, its entry is automatically removed from the underlying cache.
 *
 * This implementation requires support for both `WeakRef` and `FinalizationRegistry`.
 *
 * @see https://caniuse.com/mdn-javascript_builtins_finalizationregistry
 * @see https://caniuse.com/mdn-javascript_builtins_weakref
 */
export class WeakCache extends BaseLocalCache {
  protected readonly cache: BaseLocalCache;
  protected readonly cacheInternal: LocalCacheInternal;
  protected readonly registry: FinalizationRegistry<string>;

  constructor(options: WeakCacheOptions) {
    super(options);
    this.cache = options.cache;
    this.cacheInternal = options.cache.internal;
    this.cacheInternal._addDisposeListener(this.onCacheDispose);
    this.registry = new FinalizationRegistry<string>(this.onGarbageCollect);
  }

  protected onGarbageCollect = (key: string) => this.cacheInternal._delete(key);

  protected onCacheDispose = (key: string, value: any, reason?: string) => {
    this.unregister(value);
    this.onDispose(key, this.unwrap(value), reason);
  };

  /** @internal */
  override _get<T>(key: string): T | null {
    return this.unwrap(this.cacheInternal._get<WeakValue>(key));
  }

  /** @internal */
  override _set<T>(key: string, value: T, options?: SetCacheOptions): void {
    this.cacheInternal._set<WeakValue>(key, this.wrapAndRegister(key, value), options);
  }

  /** @internal */
  override _delete(key: string): void {
    this.unregisterByKey(key);
    this.cacheInternal._delete(key);
  }

  /** @internal */
  override _getMany<T>(keys: string[]): Record<string, T | null> {
    const data = this.cacheInternal._getMany<any>(keys);

    for (const key of keys) {
      data[key] = this.unwrap(data[key]);
    }

    return data;
  }

  /** @internal */
  override _setMany<T>(data: Record<string, T>, options?: SetCacheOptions): void {
    Object.keys(data).forEach(key => this.unregisterByKey(key));

    const wrappedData: Record<string, WeakValue> = {};

    for (const [key, value] of Object.entries(data)) {
      wrappedData[key] = this.wrapAndRegister(key, value);
    }

    this.cacheInternal._setMany<WeakValue>(wrappedData, options);
  }

  /** @internal */
  override _deleteMany(keys: string[]): void {
    keys.forEach(key => this.unregisterByKey(key));

    this.cacheInternal._deleteMany(keys);
  }

  override async getOrLoad<T>(key: string, load: () => Promise<T>, options?: SetCacheOptions): Promise<T> {
    const wrappedLoad = async () => this.wrapAndRegister(key, await load());

    return this.unwrap<T>(await this.cache.getOrLoad<WeakValue>(key, wrappedLoad, options))!;
  }

  /**
   * Wraps the value in a WeakRef and registers it in the FinalizationRegistry if it's an object.
   *
   * @param key The key to reference the value in the FinalizationRegistry
   * @param value The value to wrap
   * @returns The wrapped value
   */
  protected wrapAndRegister(key: string, value: any): WeakValue {
    this.unregisterByKey(key);

    if (value !== null && typeof value === 'object') {
      this.registry.register(value, key);

      return { v: new WeakRef(value), w: true };
    }

    return { v: value, w: false };
  }

  /**
   * Unwraps the value from a WeakRef if it's an object.
   *
   * @param data The data to unwrap
   * @returns The unwrapped value
   */
  protected unwrap<T>(data: WeakValue | null): T | null {
    if (data === null) {
      return null;
    }

    if (data.w) {
      return data.v.deref() ?? null;
    }

    return data.v;
  }

  /**
   * Unregisters the value from the FinalizationRegistry if it's an object.
   *
   * @param value The value to unregister
   */
  protected unregister(value: WeakValue | null): void {
    if (value && value.w) {
      this.registry.unregister(value.v);
    }
  }

  /**
   * Unregisters the value associated with the given key from the FinalizationRegistry.
   *
   * @param key The key
   */
  protected unregisterByKey(key: string): void {
    this.unregister(this.cacheInternal._get<WeakValue>(key));
  }
}
