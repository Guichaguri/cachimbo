// Play with these variables and see how it affects caching behavior
// All variables are in seconds

const avgSecs = 3; // Average time a request should take
const errorSecs = 0.5; // The amount of random error to add to the request time
const ttl = 10; // The amount of time items should remain cached

// ---

import { httpServer, loadWithCache } from './utils/samples.js';
import { Redis } from 'ioredis';
import { LocalTTLCache, IORedisBackplane } from '../src/index.js';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const cache = new IORedisBackplane({
  cache: new LocalTTLCache(),
  publishClient: redis,
  subscriptionClient: redis.duplicate(),
  channel: 'sample-backplane',
});

httpServer(async (req) => {
  return await loadWithCache(cache, req.url, avgSecs, errorSecs, ttl);
});
