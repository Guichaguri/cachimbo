import type { SetCacheOptions } from '../types/cache.js';
import { BaseCache } from './index.js';

type LocalCacheDisposeListener<T = any> = (key: string, value: T, reason?: string) => void;

/**
 * Internal methods for synchronous cache operations.
 * @experimental
 */
export interface LocalCacheInternal {
  _get<T>(key: string): T | null;
  _set<T>(key: string, value: T, options?: SetCacheOptions): void;
  _delete(key: string): void;
  _getMany<T>(keys: string[]): Record<string, T | null>;
  _setMany<T>(data: Record<string, T>, options?: SetCacheOptions): void;
  _deleteMany(keys: string[]): void;
  _addDisposeListener(listener: LocalCacheDisposeListener): void;
}

export abstract class BaseLocalCache extends BaseCache {
  protected disposeListeners: LocalCacheDisposeListener[] = [];

  /**
   * Reads the cached resource from a key (synchronous version)
   */
  protected abstract _get<T>(key: string): T | null;

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
  protected _getMany<T>(keys: string[]): Record<string, T | null> {
    return Object.fromEntries(
      keys.map(key => [key, this._get<T>(key)])
    );
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
  get<T>(key: string): Promise<T | null> {
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
  override getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
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
