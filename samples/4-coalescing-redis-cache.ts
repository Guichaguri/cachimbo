import { httpServer, loadWithCache } from './utils/samples.js';
import { createClient } from '@redis/client';
import { RedisCache, CoalescingCache } from '../src/index.js';

const avgMs = 3000;
const errorMs = 500;
const ttl = 10_000;

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

const cache = new CoalescingCache({
  cache: new RedisCache({
    client: redis,
  }),
});

httpServer(async (req) => {
  return await loadWithCache(cache, req.url, avgMs, errorMs, ttl);
});
