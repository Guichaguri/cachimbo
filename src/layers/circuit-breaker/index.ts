import type { BaseCacheOptions, ICache, LoadContext, SetCacheOptions } from '../../types/cache.js';
import type { Logger } from '../../types/logger.js';

/**
 * The state of the circuit.
 *
 * - **closed**: the underlying cache is healthy and every operation goes through it.
 * - **open**: the underlying cache is considered unavailable, operations fail immediately without reaching it.
 * - **half-open**: a single operation is let through to check whether the underlying cache recovered.
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * The cache operation that was short-circuited
 */
export type CircuitBreakerOperation = 'get' | 'getOrLoad' | 'set' | 'delete' | 'getMany' | 'setMany' | 'deleteMany';

/**
 * The options to construct the {@link CircuitBreakerCache}
 */
export interface CircuitBreakerCacheOptions extends BaseCacheOptions {
  /**
   * The underlying cache
   */
  cache: ICache;

  /**
   * The amount of failures within {@link CircuitBreakerCacheOptions#failureWindow} that opens the circuit.
   *
   * @defaultValue 5
   */
  failureThreshold?: number;

  /**
   * The time window in seconds in which the failures are counted.
   *
   * Failures older than this are discarded, so an occasional error does not
   * accumulate over hours until it trips the circuit.
   *
   * @defaultValue 10
   */
  failureWindow?: number;

  /**
   * The amount of seconds the circuit stays open before letting an operation through to probe the cache.
   *
   * @defaultValue 30
   */
  resetTimeout?: number;

  /**
   * The amount of consecutive successful probes needed to close the circuit again.
   *
   * Only one probe runs at a time, so a higher value takes longer to recover
   * but is less likely to reopen right after closing.
   *
   * @defaultValue 1
   */
  successThreshold?: number;

  /**
   * A callback that is called whenever the circuit changes state.
   * This is useful for observability.
   *
   * @param state The state the circuit moved to
   * @param previousState The state the circuit was in
   */
  onStateChange?: (state: CircuitBreakerState, previousState: CircuitBreakerState) => void;
}

/**
 * The error thrown by {@link CircuitBreakerCache} when the circuit is open.
 *
 * The underlying cache was not called at all, so this never means the cached resource is missing.
 */
export class CircuitBreakerOpenError extends Error {
  /**
   * The cache operation that was not sent to the underlying cache
   */
  public readonly operation: CircuitBreakerOperation;

  /**
   * @param operation The cache operation that was not sent to the underlying cache
   * @param cause The error that opened the circuit, which is what actually went wrong
   */
  constructor(operation: CircuitBreakerOperation, cause?: unknown) {
    super(`The circuit breaker is open, "${operation}" was not sent to the underlying cache.`, { cause });

    this.name = 'CircuitBreakerOpenError';
    this.operation = operation;
  }
}

/**
 * A cache layer that stops calling an unhealthy cache store.
 *
 * When a cache store starts failing, every operation still pays for the round-trip
 * before erroring out, which is often a connection timeout. This layer counts those failures
 * and, once they cross a threshold, short-circuits the operations by throwing a
 * {@link CircuitBreakerOpenError} instead of calling the store. After a while, a single operation
 * is let through to check whether the store recovered.
 *
 * Since this layer throws when the circuit is open, it is meant to be combined with a
 * {@link FailSafeCache} on top of it, which turns the error into the behaviour your application needs.
 *
 * @example
 * ```ts
 * const cache = new FailSafeCache({
 *   cache: new CircuitBreakerCache({
 *     cache: new RedisCache({ client: redisClient }),
 *   }),
 * });
 * ```
 *
 * @see https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern
 */
export class CircuitBreakerCache implements ICache {
  protected readonly cache: ICache;
  protected readonly name?: string;
  protected readonly logger?: Logger;
  protected readonly onStateChange?: (state: CircuitBreakerState, previousState: CircuitBreakerState) => void;

  protected failureThreshold: number;
  protected failureWindow: number;
  protected resetTimeout: number;
  protected successThreshold: number;

  protected state: CircuitBreakerState = 'closed';

  /**
   * Increments on every state change.
   *
   * Operations record it when they start and their result is discarded when it no longer matches,
   * so a request that was already in flight when the circuit changed state cannot affect the new one.
   */
  protected generation: number = 0;

  /** The timestamps of the failures still inside the failure window */
  protected failures: number[] = [];

  /** The unix epoch in which the circuit was opened */
  protected openedAt: number = 0;

  /** The error that opened the circuit */
  protected lastError: unknown;

  /** The amount of consecutive successful probes in the half-open state */
  protected successes: number = 0;

  /** Whether a probe is currently in flight in the half-open state */
  protected probing: boolean = false;

  constructor(options: CircuitBreakerCacheOptions) {
    this.cache = options.cache;
    this.name = options.name;
    this.logger = options.logger;
    this.onStateChange = options.onStateChange;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.failureWindow = options.failureWindow ?? 10;
    this.resetTimeout = options.resetTimeout ?? 30;
    this.successThreshold = options.successThreshold ?? 1;
  }

  get<T>(key: string): Promise<T | undefined> {
    this.logger?.debug(this.name, '[get]', 'key =', key);

    return this.run('get', () => this.cache.get<T>(key));
  }

  async getOrLoad<T>(key: string, load: (ctx: LoadContext) => Promise<T>, options?: SetCacheOptions): Promise<T> {
    this.logger?.debug(this.name, '[getOrLoad]', 'key =', key);

    const generation = this.ensureAllowed('getOrLoad');

    let loadErrored = false;

    const loadWrapped = async (ctx: LoadContext): Promise<T> => {
      try {
        return await load(ctx);
      } catch (error) {
        loadErrored = true;
        throw error;
      }
    };

    try {
      const data = await this.cache.getOrLoad<T>(key, loadWrapped, options);

      this.onSuccess(generation);

      return data;
    } catch (error) {
      // An error thrown by the load function comes from the origin and not from the cache,
      // so it must not count towards opening the circuit
      if (loadErrored) {
        this.releaseProbe(generation);

        throw error;
      }

      this.onFailure('getOrLoad', error, generation);

      throw error;
    }
  }

  set<T>(key: string, value: T, options?: SetCacheOptions): Promise<void> {
    this.logger?.debug(this.name, '[set]', 'key =', key);

    return this.run('set', () => this.cache.set<T>(key, value, options));
  }

  delete(key: string): Promise<void> {
    this.logger?.debug(this.name, '[delete]', 'key =', key);

    return this.run('delete', () => this.cache.delete(key));
  }

  getMany<T>(keys: string[]): Promise<Record<string, T>> {
    this.logger?.debug(this.name, '[getMany]', 'keys =', keys);

    return this.run('getMany', () => this.cache.getMany<T>(keys));
  }

  setMany<T>(data: Record<string, T>, options?: SetCacheOptions): Promise<void> {
    this.logger?.debug(this.name, '[setMany]', 'data =', data);

    return this.run('setMany', () => this.cache.setMany<T>(data, options));
  }

  deleteMany(keys: string[]): Promise<void> {
    this.logger?.debug(this.name, '[deleteMany]', 'keys =', keys);

    return this.run('deleteMany', () => this.cache.deleteMany(keys));
  }

  /**
   * Gets the current state of the circuit.
   *
   * An open circuit is only moved to half-open by the next operation, so this keeps
   * returning `open` while the reset timeout has elapsed but nothing has been requested yet.
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Runs a cache operation through the circuit.
   *
   * @param operation The operation being run
   * @param execute The function that calls the underlying cache
   */
  protected async run<T>(operation: CircuitBreakerOperation, execute: () => Promise<T>): Promise<T> {
    const generation = this.ensureAllowed(operation);

    try {
      const result = await execute();

      this.onSuccess(generation);

      return result;
    } catch (error) {
      this.onFailure(operation, error, generation);

      throw error;
    }
  }

  /**
   * Throws when the underlying cache should not be called.
   *
   * @param operation The operation being run
   * @returns The generation the operation belongs to
   * @throws CircuitBreakerOpenError When the circuit is open or already probing
   */
  protected ensureAllowed(operation: CircuitBreakerOperation): number {
    if (this.state === 'closed') {
      return this.generation;
    }

    if (this.state === 'open') {
      if (Date.now() - this.openedAt < this.resetTimeout * 1000) {
        throw new CircuitBreakerOpenError(operation, this.lastError);
      }

      this.changeState('half-open');
    }

    // Only one probe runs at a time, so a recovering cache is not flooded with requests
    if (this.probing) {
      throw new CircuitBreakerOpenError(operation, this.lastError);
    }

    this.probing = true;

    return this.generation;
  }

  /**
   * Registers a successful cache operation.
   *
   * @param generation The generation the operation belongs to
   */
  protected onSuccess(generation: number): void {
    if (generation !== this.generation || this.state !== 'half-open') {
      return;
    }

    this.probing = false;
    this.successes++;

    if (this.successes >= this.successThreshold) {
      this.changeState('closed');
    }
  }

  /**
   * Registers a failed cache operation, opening the circuit once there are too many of them.
   *
   * @param operation The operation that failed
   * @param error The error thrown by the underlying cache
   * @param generation The generation the operation belongs to
   */
  protected onFailure(operation: CircuitBreakerOperation, error: unknown, generation: number): void {
    this.logger?.debug(this.name, '[onFailure] The underlying cache failed.',
      'operation =', operation, 'state =', this.state, 'error =', error);

    // The operation started before the circuit changed state, which means it was already in flight
    // when the circuit tripped. Counting it would keep pushing the reset timeout forward.
    if (generation !== this.generation) {
      return;
    }

    // A failed probe means the cache has not recovered yet
    if (this.state === 'half-open') {
      this.open(error);

      return;
    }

    const now = Date.now();
    const windowStart = now - this.failureWindow * 1000;

    this.failures = this.failures.filter(timestamp => timestamp > windowStart);
    this.failures.push(now);

    if (this.failures.length >= this.failureThreshold) {
      this.open(error);
    }
  }

  /**
   * Releases the probe without counting the operation as a success or a failure.
   *
   * @param generation The generation the operation belongs to
   */
  protected releaseProbe(generation: number): void {
    if (generation === this.generation) {
      this.probing = false;
    }
  }

  /**
   * Opens the circuit, stopping any call to the underlying cache until the reset timeout elapses.
   *
   * @param error The error that opened the circuit
   */
  protected open(error: unknown): void {
    this.openedAt = Date.now();
    this.lastError = error;

    this.changeState('open');
  }

  /**
   * Moves the circuit to another state, discarding everything the previous state was tracking.
   *
   * @param state The state to move to
   */
  protected changeState(state: CircuitBreakerState): void {
    const previousState = this.state;

    this.state = state;
    this.generation++;
    this.failures = [];
    this.successes = 0;
    this.probing = false;

    this.logger?.debug(this.name, '[changeState] The circuit changed state.',
      'state =', state, 'previousState =', previousState);

    this.onStateChange?.(state, previousState);
  }

}
