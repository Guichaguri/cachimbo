import { httpServer, loadWithCache } from './utils/samples.js';
import { createClient } from '@redis/client';
import { RedisCache, TieredCache, LocalTTLCache, WeakCache, SWRCache } from '../src/index.js';

const avgMs = 3000;
const errorMs = 500;
const localTTL = 1500;
const ttl = 10_000;
const staleTTL = 5000;

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

const cache = new TieredCache({
  tiers: [
    {
      // TTL Cache using weak references, so items can be garbage collected when needed
      cache: new WeakCache({
        cache: new LocalTTLCache(),
      }),
      options: { ttl: localTTL }
    },
    {
      // Redis cache with Stale-While-Revalidate layer, so stale items can be served while revalidating in background
      cache: new SWRCache({
        cache: new RedisCache({
          client: redis,
        }),
        defaultTTL: ttl,
        staleTTL: staleTTL,
      }),
    }
  ],
});

httpServer(async (req) => {
  return await loadWithCache(cache, req.url, avgMs, errorMs, ttl);
});
