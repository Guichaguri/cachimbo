import { BaseCache } from '../../base/index.js';
import type { BaseCacheOptions, SetCacheOptions } from '../../types/cache.js';
import { IDBKeyRange } from 'fake-indexeddb';

export interface IndexedDBCacheOptions extends BaseCacheOptions {
  /**
   * A custom IndexedDB implementation
   *
   * @default `window.indexedDB`
   */
  indexedDB?: IDBFactory;

  /**
   * The IndexedDB database name
   */
  dbName: string;

  /**
   * The store name
   *
   * @default "cache"
   */
  storeName?: string;

  /**
   * Whether it should evict when expired items are accessed.
   *
   * If this is set to `true`, expired items will be automatically evicted when one is accessed.
   *
   * @default true
   */
  shouldAutoEvict?: boolean;
}

interface IDBStoredEntry<T> {
  /** Stored data */
  v: T;

  /** Expiration time in unix epoch */
  e?: number;
}

/**
 * An IndexedDB cache store. It doesn't support TTL
 *
 * This implementation was mostly based on idb-keyval.
 */
export class IndexedDBCache extends BaseCache {
  protected readonly idb: IDBFactory;
  protected readonly dbName: string;
  protected readonly storeName: string;
  protected readonly shouldAutoEvict: boolean;
  protected dbPromise: Promise<IDBDatabase> | null = null;
  protected shouldEvict: boolean = true;

  constructor(options: IndexedDBCacheOptions) {
    super(options);
    this.idb = options.indexedDB ?? indexedDB;
    this.dbName = options.dbName;
    this.storeName = options.storeName || 'cache';
    this.shouldAutoEvict = options.shouldAutoEvict ?? true;
  }

  async get<T>(key: string): Promise<T | null> {
    return await this.do('readonly', store => this.storeGet(store, key));
  }

  async set<T>(key: string, value: T, options: SetCacheOptions = {}): Promise<void> {
    const entry: IDBStoredEntry<T> = {
      v: value,
      e: options.ttl ? Date.now() + options.ttl * 1000 : undefined,
    };

    await this.do('readwrite', store => {
      store.put(entry, key);
      return this.promisifyRequest(store.transaction);
    });

    await this.autoEvict();
  }

  async delete(key: string): Promise<void> {
    await this.do('readwrite', store => {
      store.delete(key);
      return this.promisifyRequest(store.transaction);
    });
  }

  override getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    return this.do('readonly', async store => {
      const data: Record<string, T | null> = {};

      await Promise.all(keys.map(async key => {
        data[key] = await this.storeGet(store, key);
      }));

      return data;
    });
  }

  override async setMany<T>(data: Record<string, T>, options: SetCacheOptions = {}): Promise<void> {
    const expiration = options.ttl ? Date.now() + options.ttl * 1000 : undefined;

    await this.do('readwrite', async store => {
      for (const [key, value] of Object.entries(data)) {
        const entry: IDBStoredEntry<T> = { v: value, e: expiration };

        store.put(entry, key);
      }

      return this.promisifyRequest(store.transaction);
    });

    await this.autoEvict();
  }

  override async deleteMany(keys: string[]): Promise<void> {
    await this.do('readwrite', async store => {
      keys.forEach(key => store.delete(key));

      return this.promisifyRequest(store.transaction);
    });
  }

  /**
   * Deletes all expired cached resources from IndexedDB.
   */
  async evict(): Promise<void> {
    await this.do('readwrite', async store => {
      store.index('e')
        .openCursor(IDBKeyRange.upperBound(Date.now()))
        .onsuccess = async (e) => {
          const cursor: IDBCursorWithValue = (e.target as IDBRequest).result;

          if (!cursor) {
            return; // Cursor finished
          }

          await this.promisifyRequest(cursor.delete());
          cursor.continue();
        };

      return this.promisifyRequest(store.transaction);
    });
    this.shouldEvict = false;
  }

  /**
   * Deletes all cached resources from IndexedDB.
   */
  async clear(): Promise<void> {
    await this.do('readwrite', async store => {
      store.clear();
      return this.promisifyRequest(store.transaction);
    });
    this.shouldEvict = false;
  }

  /**
   * Gets the IndexedDB database instance, creating it if it doesn't exist.
   */
  protected getDatabase(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    const request = this.idb.open(this.dbName);

    request.onupgradeneeded = () => request.result.createObjectStore(this.storeName).createIndex('e', 'e', { unique: false });

    this.dbPromise = this.promisifyRequest(request);

    this.autoEvict();

    return this.dbPromise;
  }

  /**
   * Executes an IndexedDB transaction
   * @param mode Whether the transaction is readonly or readwrite
   * @param runner The function that will run the transaction
   */
  protected async do<T>(mode: IDBTransactionMode, runner: (store: IDBObjectStore) => Promise<T>): Promise<T> {
    return this.getDatabase().then(
      db => runner(db.transaction(this.storeName, mode).objectStore(this.storeName))
    );
  }

  /**
   * Converts an IndexedDB request into a Promise that resolves with the result.
   * @param request The request to convert
   */
  protected promisifyRequest<T>(request: IDBRequest<T> | IDBTransaction): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // @ts-ignore
      request.oncomplete = request.onsuccess = () => resolve(request.result);
      // @ts-ignore
      request.onabort = request.onerror = () => reject(request.error);
    });
  }

  /**
   * Loads an item from the database and validates the expiration time
   * @param store The transaction store
   * @param key The item key
   */
  protected async storeGet<T>(store: IDBObjectStore, key: string): Promise<T | null> {
    const entry: IDBStoredEntry<T> | undefined = await this.promisifyRequest(store.get(key));

    if (entry === undefined) {
      return null;
    }

    if (entry.e && Date.now() >= entry.e) {
      // Mark for deletion on next auto-evict
      this.shouldEvict = true;
      return null;
    }

    return entry.v;
  }

  /**
   * Automatically evicts if needed
   */
  protected async autoEvict(): Promise<void> {
    if (this.shouldAutoEvict && this.shouldEvict) {
      await this.evict();
    }
  }

}
