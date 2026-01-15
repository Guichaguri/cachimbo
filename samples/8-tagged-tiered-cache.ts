// Play with these variables and see how it affects caching behavior
// All variables are in seconds

const avgSecs = 3; // Average time a request should take
const errorSecs = 0.5; // The amount of random error to add to the request time
const localTTL = 15; // The amount of time items should remain cached in the in-memory cache
const ttl = 30; // The amount of time items should remain cached in Redis
const tagTTL = 30; // The amount of time tags should remain valid. Should be as long as the longest cache TTL.

// ---

import { httpServer, loadWithCache } from './utils/samples.js';
import { createClient } from '@redis/client';
import { RedisCache, TieredCache, LocalTTLCache, TaggedCache } from '../src/index.js';

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.connect();

const cache = new TaggedCache({
  cache: new TieredCache({
    tiers: [
      {
        // TTL Cache
        cache: new LocalTTLCache(),
        options: { ttl: localTTL }
      },
      {
        // Redis cache
        cache: new RedisCache({ client: redis }),
      }
    ],
  }),
  tagTTL: tagTTL,
});

httpServer(async (req) => {
  if (req.url === '/invalidate') {
    await cache.invalidateTag('sample-tag');
    return { invalidated: 'sample-tag' };
  }

  return await loadWithCache(cache, req.url, avgSecs, errorSecs, ttl, { tags: ['sample-tag'] });
});
