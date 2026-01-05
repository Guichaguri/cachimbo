// Play with these variables and see how it affects caching behavior
// All variables are in seconds

const avgSecs = 3; // Average time a request should take
const errorSecs = 0.5; // The amount of random error to add to the request time
const ttl = 10; // The amount of time items should remain cached

// ---

import { httpServer, loadWithCache } from './utils/samples.js';
import { createClient } from '@redis/client';
import { RedisCache } from '../src/index.js';

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.connect();

const cache = new RedisCache({
  client: redis,
});

httpServer(async (req) => {
  return await loadWithCache(cache, req.url, avgSecs, errorSecs, ttl);
});
