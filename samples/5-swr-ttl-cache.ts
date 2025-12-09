import { httpServer, loadWithCache } from './utils/samples.js';
import { LocalTTLCache } from '../src/local/ttl/index.js';
import { SWRCache } from '../src/layers/swr/index.js';

const avgMs = 3000;
const errorMs = 500;
const ttl = 10_000;
const staleTTL = 5000;

const cache = new SWRCache({
  cache: new LocalTTLCache(),
  defaultTTL: ttl,
  staleTTL: staleTTL,
});

httpServer(async (req) => {
  return await loadWithCache(cache, req.url, avgMs, errorMs, ttl);
});
