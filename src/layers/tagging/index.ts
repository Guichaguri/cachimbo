import type { BaseCacheOptions, ICache, SetCacheOptions } from '../../types/cache.js';
import type { Logger } from '../../types/logger.js';

export interface TaggingCacheOptions extends BaseCacheOptions {
  /**
   * The underlying cache
   */
  cache: ICache;

  /**
   * The tag entry prefix
   */
  tagPrefix?: string;

  /**
   * The amount of seconds the tagging metadata should live in cache.
   *
   * This should be higher than the highest TTL used in the cache to avoid orphaned tags.
   *
   * @defaultValue 86400 (24 hours)
   */
  tagTTL?: number;
}

export interface SetTaggingCacheOptions extends SetCacheOptions {
  tags?: string[];
}

interface TaggedValue<T> {
  v: T;
  d: number;
  t: string[];
}

export class TaggingCache implements ICache {
  protected readonly cache: ICache;
  protected readonly logger?: Logger;
  protected readonly name?: string;
  protected tagPrefix: string;
  protected tagTTL: number;

  constructor(options: TaggingCacheOptions) {
    this.cache = options.cache;
    this.logger = options.logger;
    this.name = options.name;
    this.tagPrefix = options.tagPrefix || '__ctag__:';
    this.tagTTL = options.tagTTL ?? 86400;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.cache.get<TaggedValue<T>>(key);

    if (value === null) {
      return null;
    }

    if (await this.isItemExpired(value.t, value.d)) {
      this.logger?.debug(this.name, '[get] Item expired due to tag invalidation. Deleting...', 'key =', key);

      await this.cache.delete(key);

      return null;
    }

    return value.v;
  }

  async set<T>(key: string, value: T, options: SetTaggingCacheOptions = {}): Promise<void> {
    const tags = options.tags || [];
    const now = Date.now();

    await this.refreshTags(tags, now);

    await this.cache.set<TaggedValue<T>>(key, { v: value, d: now, t: tags }, options);
  }

  delete(key: string): Promise<void> {
    return this.cache.delete(key);
  }

  async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    const data = await this.cache.getMany<TaggedValue<T>>(keys);

    return Object.fromEntries(
      await Promise.all(
        Object.entries(data).map(async ([key, value]) => {
          if (value === null) {
            return [key, null];
          }

          if (await this.isItemExpired(value.t, value.d)) {
            this.logger?.debug(this.name, '[getMany] Item expired due to tag invalidation. Deleting...', 'key =', key);

            await this.cache.delete(key);

            return [key, null];
          }

          return [key, value.v];
        }),
      ),
    );
  }

  async setMany<T>(data: Record<string, T>, options: SetTaggingCacheOptions = {}): Promise<void> {
    const taggedData: Record<string, TaggedValue<T>> = {};
    const tags = options.tags || [];
    const now = Date.now();

    for (const [key, value] of Object.entries(data)) {
      taggedData[key] = { v: value, d: now, t: tags };
    }

    await this.refreshTags(tags, now);

    await this.cache.setMany<TaggedValue<T>>(taggedData, options);
  }

  deleteMany(keys: string[]): Promise<void> {
    return this.cache.deleteMany(keys);
  }

  async getOrLoad<T>(key: string, load: () => Promise<T>, options: SetTaggingCacheOptions = {}): Promise<T> {
    const tags = options.tags || [];
    const now = Date.now();

    let hasLoaded = false;

    const loadWithTags = async (): Promise<TaggedValue<T>> => {
      const value = await load();

      await this.refreshTags(tags, now);

      hasLoaded = true;

      return { v: value, d: now, t: tags };
    };

    let value = await this.cache.getOrLoad<TaggedValue<T>>(key, loadWithTags, options);

    // We'll only check if the item is expired if it was not loaded from source
    if (!hasLoaded && await this.isItemExpired(value.t, value.d)) {
      this.logger?.debug(this.name, '[getOrLoad] Item expired due to tag invalidation. Loading from source...', 'key =', key);

      // If it is expired, we force load from source
      value = await loadWithTags();

      await this.cache.set<TaggedValue<T>>(key, value, options);
      await this.refreshTags(tags, now);
    }

    return value.v;
  }

  /**
   * Invalidate all items by a tag.
   *
   * @param tag The tag name
   */
  invalidateTag(tag: string): Promise<void> {
    this.logger?.debug(this.name, '[invalidateTag] Invalidating a tag.', 'tag =', tag);

    return this.cache.set<number>(this.tagPrefix + tag, Date.now(), { ttl: this.tagTTL });
  }

  /**
   * Invalidate all items by multiple tags.
   *
   * @param tags The list of tag names
   */
  invalidateTags(tags: string[]): Promise<void> {
    this.logger?.debug(this.name, '[invalidateTags] Invalidating a list of tags.', 'tags =', tags);

    const data: Record<string, number> = {};
    const now = Date.now();

    for (const tag of tags) {
      data[this.tagPrefix + tag] = now;
    }

    return this.cache.setMany<number>(data, { ttl: this.tagTTL });
  }

  /**
   * Refreshes the TTLs from all tags.
   * If a tag is not in cache, refreshes it with the provided timestamp.
   *
   * @param tags The list of tags
   * @param timestamp The initial timestamp for the missing tags
   */
  protected async refreshTags(tags: string[], timestamp: number): Promise<void> {
    if (tags.length === 0) {
      return;
    }

    this.logger?.debug(this.name, '[refreshTags] Refreshing the TTL of the tags entries.', 'tags =', tags);

    const keys = tags.map(tag => this.tagPrefix + tag);
    const currentTimestamps = await this.cache.getMany<number>(keys);
    const newTimestamps: Record<string, number> = {};

    for (const key of keys) {
      newTimestamps[key] = currentTimestamps[key] || timestamp;
    }

    await this.cache.setMany<number>(newTimestamps, { ttl: this.tagTTL });
  }

  /**
   * Checks whether any of the tags has expired since the provided timestamp.
   *
   * @param tags The list of tags
   * @param timestamp The timestamp to check against
   */
  protected async isItemExpired(tags: string[], timestamp: number): Promise<boolean> {
    if (tags.length === 0) {
      return false;
    }

    const keys = tags.map(tag => this.tagPrefix + tag);

    const tagsExpirations = await this.cache.getMany<number>(keys);

    for (const tag of keys) {
      const tagTimestamp = tagsExpirations[tag];

      if (!tagTimestamp || tagTimestamp > timestamp) {
        return true;
      }
    }

    return false;
  }
}
