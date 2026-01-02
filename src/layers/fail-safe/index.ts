import type { BaseCacheOptions, ICache, SetCacheOptions } from '../../types/cache.js';

export interface FailSafeCacheOptions extends BaseCacheOptions {
  /**
   * The underlying cache
   */
  cache: ICache;

  /**
   * The error policy
   */
  policy?: ErrorPolicy;

  /**
   * A callback that is called when an error occurs.
   * This is useful for logging or metrics.
   *
   * @param operation In which operation call the error occurred
   * @param error The error that occurred
   */
  onError?: (operation: ErrorPolicyOperation, error: unknown) => void;
}

type ErrorPolicyOperation = 'get' | 'set' | 'delete' | 'getOrLoad';

export interface ErrorPolicy {
  /**
   * Policy for when the {@link ICache#get} and {@link ICache#getMany} throw errors
   *
   * - 'fail-open': return null on error
   * - 'fail-closed': throw on error
   *
   * @defaultValue 'fail-open'
   */
  get?: 'fail-open' | 'fail-closed';

  /**
   * Policy for when the {@link ICache#set} and {@link ICache#setMany} throws errors
   *
   * - 'fail-open': does nothing on error
   * - 'fail-closed': throw on error
   *
   * @defaultValue 'fail-open'
   */
  set?: 'fail-open' | 'fail-closed';

  /**
   * Policy for when the {@link ICache#delete} and {@link ICache#deleteMany} throws errors
   *
   * - 'fail-open': does nothing on error
   * - 'fail-closed': throw on error
   *
   * @defaultValue 'fail-closed'
   */
  delete?: 'fail-open' | 'fail-closed';

  /**
   * Policy for when the {@link ICache#getOrLoad} throws errors.
   * This does not include errors from the `load` function, only the cache operations.
   *
   * - 'fail-open': loads from origin on error
   * - 'fail-closed': throw on error
   *
   * @defaultValue 'fail-open'
   */
  getOrLoad?: 'fail-open' | 'fail-closed';
}

/**
 * Handles errors from an underlying cache according to a specified policy.
 *
 * @see https://read.thecoder.cafe/p/fail-open-fail-closed
 */
export class FailSafeCache implements ICache {
  protected readonly cache: ICache;
  protected readonly policy: ErrorPolicy;
  protected readonly onError?: (operation: ErrorPolicyOperation, error: unknown) => void;

  constructor(options: FailSafeCacheOptions) {
    this.cache = options.cache;
    this.policy = {
      get: 'fail-open',
      set: 'fail-open',
      delete: 'fail-closed',
      getOrLoad: 'fail-open',
      ...options.policy || {},
    };
    this.onError = options.onError;
  }

  get<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(key).catch(error => this.handleError('get', error, null));
  }

  getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    return this.cache.getMany<T>(keys).catch(error => this.handleError('get', error, {}));
  }

  set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    return this.cache.set(key, value, options).catch(error => this.handleError('set', error, void 0));
  }

  setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void> {
    return this.cache.setMany(data, options).catch(error => this.handleError('set', error, void 0));
  }

  delete(key: string): Promise<void> {
    return this.cache.delete(key).catch(error => this.handleError('delete', error, void 0));
  }

  deleteMany(keys: string[]): Promise<void> {
    return this.cache.deleteMany(keys).catch(error => this.handleError('delete', error, void 0));
  }

  async getOrLoad<T>(key: string, load: () => Promise<T>, options?: SetCacheOptions): Promise<T> {
    let loadResult: T;
    let loadErrored = false;
    let loadSuccessful = false;

    const loadWithErrorHandling = async (): Promise<T> => {
      try {
        loadResult = await load();
        loadSuccessful = true;
        return loadResult;
      } catch (error) {
        loadErrored = true;
        throw error;
      }
    };

    try {
      return await this.cache.getOrLoad(key, loadWithErrorHandling, options);
    } catch (error) {
      // We pass through load errors
      if (loadErrored) {
        throw error;
      }

      // We let the errors be handled according to policy
      await this.handleError('getOrLoad', error, null);

      // In case handleError didn't throw, we load from origin
      return loadSuccessful ? loadResult! : await load();
    }
  }

  protected handleError<T>(operation: ErrorPolicyOperation, error: unknown, failOpenValue: T): Promise<T> {
    this.onError?.(operation, error);

    const policy = this.policy[operation];

    if (policy === 'fail-open') {
      return Promise.resolve(failOpenValue);
    } else {
      return Promise.reject(error);
    }
  }
}
