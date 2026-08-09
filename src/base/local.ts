import type { SetCacheOptions } from '../types/cache.js';
import { BaseCache } from './index.js';

type LocalCacheDisposeListener<T = any> = (key: string, value: T, reason?: string) => void;

/**
 * Internal methods for synchronous cache operations.
 * @experimental
 */
export interface LocalCacheInternal {
  _get<T>(key: string): T | undefined;
  _set<T>(key: string, value: T, options?: SetCacheOptions): void;
  _delete(key: string): void;
  _getMany<T>(keys: string[]): Record<string, T>;
  _setMany<T>(data: Record<string, T>, options?: SetCacheOptions): void;
  _deleteMany(keys: string[]): void;
  _addDisposeListener(listener: LocalCacheDisposeListener): void;
}

/**
 * The base implementation of an in-memory cache.
 *
 * Subclasses implement the synchronous {@link BaseLocalCache#_get}, {@link BaseLocalCache#_set} and
 * {@link BaseLocalCache#_delete} methods. The asynchronous {@link ICache} methods are implemented here
 * and simply wrap the results in a resolved promise, so no operation ever actually awaits.
 *
 * Extending this class instead of {@link BaseCache} is what allows layers that need synchronous access,
 * such as {@link WeakCache} and {@link DeepCloningCache}, to be stacked on top of the cache.
 *
 * Implementations must report overwritten, deleted and evicted items through
 * {@link BaseLocalCache#onDispose}, otherwise those layers cannot keep track of the stored values.
 *
 * @see https://github.com/Guichaguri/cachimbo/blob/HEAD/docs/guides/extending.md
 */
export abstract class BaseLocalCache extends BaseCache {
  protected disposeListeners: LocalCacheDisposeListener[] = [];

  /**
   * Reads the cached resource from a key (synchronous version)
   */
  protected abstract _get<T>(key: string): T | undefined;

  /**
   * Writes a resource into cache (synchronous version)
   */
  protected abstract _set<T>(key: string, value: T, options?: SetCacheOptions): void;

  /**
   * Deletes a cached resource by a key. (synchronous version)
   */
  protected abstract _delete(key: string): void;

  /**
   * Reads cached resources by their keys. (synchronous version)
   */
  protected _getMany<T>(keys: string[]): Record<string, T> {
    const data: Record<string, T> = Object.create(null);

    for (const key of keys) {
      const value = this._get<T>(key);

      if (value !== undefined) {
        data[key] = value;
      }
    }

    return data;
  }

  /**
   * Writes resources into cache. (synchronous version)
   */
  protected _setMany<T>(data: Record<string, T>, options?: SetCacheOptions): void {
    for (const [key, value] of Object.entries(data)) {
      this._set<T>(key, value, options);
    }
  }

  /**
   * Deletes many cached resources by their keys. (synchronous version)
   */
  protected _deleteMany(keys: string[]): void {
    for (const key of keys) {
      this._delete(key);
    }
  }

  /**
   * Adds a listener that will be called when a cached item is disposed.
   *
   * @param listener The listener function to add.
   */
  protected _addDisposeListener(listener: LocalCacheDisposeListener): void {
    this.disposeListeners.push(listener);
  }

  /**
   * Gets access to the internal synchronous methods.
   * @experimental
   */
  get internal(): LocalCacheInternal {
    return this as unknown as LocalCacheInternal;
  }

  /** @sealed **/
  get<T>(key: string): Promise<T | undefined> {
    return Promise.resolve(this._get<T>(key));
  }

  /** @sealed **/
  set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    this._set(key, value, options);
    return Promise.resolve();
  }

  /** @sealed **/
  delete(key: string): Promise<void> {
    this._delete(key);
    return Promise.resolve();
  }

  /** @sealed **/
  override getMany<T>(keys: string[]): Promise<Record<string, T>> {
    return Promise.resolve(this._getMany(keys));
  }

  /** @sealed **/
  override setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void> {
    this._setMany(data, options);
    return Promise.resolve();
  }

  /** @sealed **/
  override deleteMany(keys: string[]): Promise<void> {
    this._deleteMany(keys);
    return Promise.resolve();
  }

  protected onDispose(key: string, value: any, reason?: string): void {
    for (const listener of this.disposeListeners) {
      listener(key, value, reason);
    }
  }

}
