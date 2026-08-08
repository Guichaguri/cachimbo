import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ICache, LoadContext } from '../../types/cache.js';
import { CircuitBreakerCache, CircuitBreakerOpenError } from './index.js';

const mockedCache = {
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  getOrLoad: vi.fn((_key, load) => load({ options: {} })),
  getMany: vi.fn().mockResolvedValue({}),
  setMany: vi.fn().mockResolvedValue(undefined),
  deleteMany: vi.fn().mockResolvedValue(undefined),
} satisfies ICache;

const dateNow = vi.spyOn(Date, 'now');

/**
 * Fails `get` enough times in a row to open the circuit
 */
async function trip(cache: CircuitBreakerCache, times = 5): Promise<void> {
  for (let i = 0; i < times; i++) {
    mockedCache.get.mockRejectedValueOnce(new Error('cache is down'));

    await expect(cache.get('key')).rejects.toThrow('cache is down');
  }
}

describe('CircuitBreakerCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dateNow.mockReturnValue(1_000_000);
  });

  describe('closed', () => {
    test('should start closed', () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache });

      expect(cache.getState()).toBe('closed');
    });

    test('should forward every operation to the underlying cache', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache });
      const load = vi.fn().mockResolvedValue('loaded');

      mockedCache.get.mockResolvedValueOnce('value');
      mockedCache.getMany.mockResolvedValueOnce({ key1: 'value1' });

      await expect(cache.get('key')).resolves.toBe('value');
      await expect(cache.getOrLoad('key', load)).resolves.toBe('loaded');
      await expect(cache.set('key', 'value', { ttl: 30 })).resolves.toBeUndefined();
      await expect(cache.delete('key')).resolves.toBeUndefined();
      await expect(cache.getMany(['key1'])).resolves.toEqual({ key1: 'value1' });
      await expect(cache.setMany({ key1: 'value1' }, { ttl: 30 })).resolves.toBeUndefined();
      await expect(cache.deleteMany(['key1'])).resolves.toBeUndefined();

      expect(mockedCache.get).toHaveBeenCalledWith('key');
      expect(mockedCache.getOrLoad).toHaveBeenCalledWith('key', expect.any(Function), undefined);
      expect(mockedCache.set).toHaveBeenCalledWith('key', 'value', { ttl: 30 });
      expect(mockedCache.delete).toHaveBeenCalledWith('key');
      expect(mockedCache.getMany).toHaveBeenCalledWith(['key1']);
      expect(mockedCache.setMany).toHaveBeenCalledWith({ key1: 'value1' }, { ttl: 30 });
      expect(mockedCache.deleteMany).toHaveBeenCalledWith(['key1']);
      expect(cache.getState()).toBe('closed');
    });

    test('should stay closed below the failure threshold', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 5 });

      await trip(cache, 4);

      expect(cache.getState()).toBe('closed');
    });

    test('should open once the failure threshold is reached', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 3 });

      await trip(cache, 3);

      expect(cache.getState()).toBe('open');
    });

    test('should discard failures older than the failure window', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 3, failureWindow: 10 });

      await trip(cache, 2);

      dateNow.mockReturnValue(1_000_000 + 11_000);

      await trip(cache, 2);

      // The first two failures fell out of the window, so the threshold was not reached
      expect(cache.getState()).toBe('closed');
    });

    test('should not open on errors thrown by the load function', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 2 });
      const load = vi.fn().mockRejectedValue(new Error('origin is down'));

      await expect(cache.getOrLoad('key', load)).rejects.toThrow('origin is down');
      await expect(cache.getOrLoad('key', load)).rejects.toThrow('origin is down');

      // The cache answered correctly, the origin is the one failing
      expect(cache.getState()).toBe('closed');
    });

    test('should open when getOrLoad fails before reaching the load function', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 1 });
      const load = vi.fn();

      mockedCache.getOrLoad.mockRejectedValueOnce(new Error('cache is down'));

      await expect(cache.getOrLoad('key', load)).rejects.toThrow('cache is down');

      expect(load).not.toHaveBeenCalled();
      expect(cache.getState()).toBe('open');
    });
  });

  describe('open', () => {
    test('should fail fast without calling the underlying cache', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 1 });

      await trip(cache, 1);
      vi.clearAllMocks();

      await expect(cache.get('key')).rejects.toThrow(CircuitBreakerOpenError);

      expect(mockedCache.get).not.toHaveBeenCalled();
    });

    test('should fail fast on every operation', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 1 });

      await trip(cache, 1);
      vi.clearAllMocks();

      await expect(cache.get('key')).rejects.toThrow(CircuitBreakerOpenError);
      await expect(cache.getOrLoad('key', vi.fn())).rejects.toThrow(CircuitBreakerOpenError);
      await expect(cache.set('key', 'value')).rejects.toThrow(CircuitBreakerOpenError);
      await expect(cache.delete('key')).rejects.toThrow(CircuitBreakerOpenError);
      await expect(cache.getMany(['key'])).rejects.toThrow(CircuitBreakerOpenError);
      await expect(cache.setMany({ key: 'value' })).rejects.toThrow(CircuitBreakerOpenError);
      await expect(cache.deleteMany(['key'])).rejects.toThrow(CircuitBreakerOpenError);

      expect(mockedCache.get).not.toHaveBeenCalled();
      expect(mockedCache.getOrLoad).not.toHaveBeenCalled();
      expect(mockedCache.set).not.toHaveBeenCalled();
      expect(mockedCache.delete).not.toHaveBeenCalled();
      expect(mockedCache.getMany).not.toHaveBeenCalled();
      expect(mockedCache.setMany).not.toHaveBeenCalled();
      expect(mockedCache.deleteMany).not.toHaveBeenCalled();
    });

    test('should tell which operation was short-circuited', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 1 });

      await trip(cache, 1);

      await expect(cache.setMany({ key: 'value' })).rejects.toMatchObject({
        name: 'CircuitBreakerOpenError',
        operation: 'setMany',
      });
    });

    test('should expose the error that opened the circuit as the cause', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 1 });

      mockedCache.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(cache.get('key')).rejects.toThrow('ECONNREFUSED');

      const error = await cache.get('key').then(
        () => undefined,
        (caught: unknown) => caught as CircuitBreakerOpenError,
      );

      expect(error).toBeInstanceOf(CircuitBreakerOpenError);
      expect(error?.cause).toBeInstanceOf(Error);
      expect((error?.cause as Error).message).toBe('ECONNREFUSED');
    });

    test('should not reopen the circuit with failures that started before it tripped', async () => {
      const onStateChange = vi.fn();
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 5, onStateChange });

      for (let i = 0; i < 10; i++) {
        mockedCache.get.mockRejectedValueOnce(new Error('cache is down'));
      }

      // All ten pass the circuit while it is still closed, then fail together
      const requests = Array.from({ length: 10 }, () => cache.get('key').catch(() => undefined));

      await Promise.all(requests);

      // The five late failures belong to the closed circuit and must not push the reset timeout forward
      expect(cache.getState()).toBe('open');
      expect(onStateChange).toHaveBeenCalledTimes(1);
      expect(onStateChange).toHaveBeenCalledWith('open', 'closed');
    });

    test('should move to half-open after the reset timeout', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 1, resetTimeout: 30 });

      await trip(cache, 1);

      dateNow.mockReturnValue(1_000_000 + 30_000);

      await expect(cache.get('key')).resolves.toBeUndefined();

      expect(mockedCache.get).toHaveBeenCalledWith('key');
    });
  });

  describe('half-open', () => {
    /**
     * Opens the circuit and moves the clock past the reset timeout
     */
    async function halfOpen(cache: CircuitBreakerCache): Promise<void> {
      await trip(cache, 1);

      dateNow.mockReturnValue(1_000_000 + 31_000);
    }

    test('should close after a successful probe', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 1 });

      await halfOpen(cache);

      await expect(cache.get('key')).resolves.toBeUndefined();

      expect(cache.getState()).toBe('closed');
    });

    test('should require every successful probe of the success threshold', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 1, successThreshold: 2 });

      await halfOpen(cache);

      await expect(cache.get('key')).resolves.toBeUndefined();
      expect(cache.getState()).toBe('half-open');

      await expect(cache.get('key')).resolves.toBeUndefined();
      expect(cache.getState()).toBe('closed');
    });

    test('should open again on a failed probe', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 5 });

      await trip(cache, 5);

      dateNow.mockReturnValue(1_000_000 + 31_000);
      mockedCache.get.mockRejectedValueOnce(new Error('cache is still down'));

      await expect(cache.get('key')).rejects.toThrow('cache is still down');

      // A single failed probe is enough, the threshold does not apply here
      expect(cache.getState()).toBe('open');
    });

    test('should only let one probe through at a time', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 1 });

      await halfOpen(cache);
      mockedCache.get.mockClear();

      let resolveProbe: (value: unknown) => void;
      mockedCache.get.mockReturnValueOnce(new Promise(resolve => { resolveProbe = resolve; }));

      const probe = cache.get('key');

      await expect(cache.get('key')).rejects.toThrow(CircuitBreakerOpenError);

      resolveProbe!('value');

      await expect(probe).resolves.toBe('value');
      expect(mockedCache.get).toHaveBeenCalledTimes(1);
    });

    test('should ignore a request that started before the circuit tripped', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 1 });
      const resolvers: ((value: unknown) => void)[] = [];

      mockedCache.get.mockImplementation(() => new Promise(resolve => { resolvers.push(resolve); }));

      // Starts while the circuit is closed and stays in flight the whole time
      const stale = cache.get('key');

      mockedCache.get.mockRejectedValueOnce(new Error('cache is down'));
      await expect(cache.get('key')).rejects.toThrow('cache is down');

      dateNow.mockReturnValue(1_000_000 + 31_000);

      const probe = cache.get('key');
      expect(cache.getState()).toBe('half-open');

      resolvers[0]!('stale-value');
      await expect(stale).resolves.toBe('stale-value');

      // A success from the closed circuit must not close it nor free the probe slot
      expect(cache.getState()).toBe('half-open');
      await expect(cache.get('key')).rejects.toThrow(CircuitBreakerOpenError);

      resolvers[1]!('probe-value');
      await expect(probe).resolves.toBe('probe-value');

      expect(cache.getState()).toBe('closed');

      mockedCache.get.mockReset().mockResolvedValue(undefined);
    });

    test('should not release the probe with a load error from before the circuit tripped', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 1 });
      let rejectLoad: (error: Error) => void;
      const slowLoad = () => new Promise<string>((_resolve, reject) => { rejectLoad = reject; });

      // Starts while the circuit is closed and stays in flight
      const stale = cache.getOrLoad('key', slowLoad).catch(() => undefined);

      mockedCache.get.mockRejectedValueOnce(new Error('cache is down'));
      await expect(cache.get('key')).rejects.toThrow('cache is down');

      dateNow.mockReturnValue(1_000_000 + 31_000);

      mockedCache.get.mockImplementationOnce(() => new Promise(() => undefined));
      const probe = cache.get('key');
      expect(cache.getState()).toBe('half-open');

      rejectLoad!(new Error('origin is down'));
      await stale;

      // The load error belongs to the closed circuit, it must not free the probe slot
      await expect(cache.get('key')).rejects.toThrow(CircuitBreakerOpenError);

      void probe;
    });

    test('should release the probe when the load function fails', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 1 });
      const load = vi.fn().mockRejectedValue(new Error('origin is down'));

      await halfOpen(cache);

      await expect(cache.getOrLoad('key', load)).rejects.toThrow('origin is down');

      // The probe was neither a success nor a failure, but it must not block the next one
      expect(cache.getState()).toBe('half-open');
      await expect(cache.get('key')).resolves.toBeUndefined();
      expect(cache.getState()).toBe('closed');
    });
  });

  describe('onStateChange', () => {
    test('should report every state transition', async () => {
      const onStateChange = vi.fn();
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 1, onStateChange });

      await trip(cache, 1);
      expect(onStateChange).toHaveBeenLastCalledWith('open', 'closed');

      dateNow.mockReturnValue(1_000_000 + 31_000);
      await expect(cache.get('key')).resolves.toBeUndefined();

      expect(onStateChange).toHaveBeenCalledWith('half-open', 'open');
      expect(onStateChange).toHaveBeenLastCalledWith('closed', 'half-open');
      expect(onStateChange).toHaveBeenCalledTimes(3);
    });

    test('should report reopening from the half-open state', async () => {
      const onStateChange = vi.fn();
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 2, onStateChange });

      await trip(cache, 2);
      expect(onStateChange).toHaveBeenCalledTimes(1);

      // Reopening from the half-open state does not report `open` twice
      dateNow.mockReturnValue(1_000_000 + 31_000);
      mockedCache.get.mockRejectedValueOnce(new Error('cache is still down'));
      await expect(cache.get('key')).rejects.toThrow('cache is still down');

      expect(onStateChange).toHaveBeenLastCalledWith('open', 'half-open');
      expect(onStateChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('logger', () => {
    test('should log the failures and the state transitions', async () => {
      const logger = { debug: vi.fn() };
      const cache = new CircuitBreakerCache({ cache: mockedCache, failureThreshold: 1, logger, name: 'CB' });

      await trip(cache, 1);

      expect(logger.debug).toHaveBeenCalledWith('CB', '[onFailure] The underlying cache failed.',
        'operation =', 'get', 'state =', 'closed', 'error =', expect.any(Error));
      expect(logger.debug).toHaveBeenCalledWith('CB', '[changeState] The circuit changed state.',
        'state =', 'open', 'previousState =', 'closed');
    });
  });

  describe('getOrLoad', () => {
    test('should pass the load context through', async () => {
      const cache = new CircuitBreakerCache({ cache: mockedCache });
      const load = vi.fn(async (ctx: LoadContext) => {
        ctx.options.ttl = 60;
        return 'loaded';
      });

      await expect(cache.getOrLoad('key', load, { ttl: 30 })).resolves.toBe('loaded');

      expect(load).toHaveBeenCalledWith({ options: expect.objectContaining({ ttl: 60 }) });
    });
  });

});
