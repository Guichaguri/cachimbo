// Play with these variables and see how it affects caching behavior
// All variables are in seconds

const avgSecs = 3; // Average time a request should take
const errorSecs = 0.5; // The amount of random error to add to the request time
const ttl = 10; // The amount of time items should remain cached

// ---

import { httpServer, loadWithCache } from './utils/samples.js';
import { LocalTTLCache } from '../src/index.js';

const cache = new LocalTTLCache();

httpServer(async (req) => {
  return await loadWithCache(cache, req.url, avgSecs, errorSecs, ttl);
});
