// Play with these variables and see how it affects caching behavior
// All variables are in seconds

const avgSecs = 3; // Average time a request should take
const errorSecs = 0.5; // The amount of random error to add to the request time
const ttl = 10; // The amount of time items should remain cached

// ---

import { httpServer, loadWithCache } from './utils/samples.js';
import Memcache from 'memcache';
import { MemcacheCache } from '../src/index.js';

const memcache = new Memcache(process.env.MEMCACHED_URL || 'localhost:11211');

const cache = new MemcacheCache({
  client: memcache,
});

httpServer(async (req) => {
  return await loadWithCache(cache, req.url, avgSecs, errorSecs, ttl);
});
