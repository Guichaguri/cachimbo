import { httpServer, load, loadWithCache } from './utils/samples.js';
import { LocalTTLCache } from '../src/local/ttl/index.js';

const avgMs = 3000;
const errorMs = 500;
const ttl = 10_000;

const cache = new LocalTTLCache();

httpServer(async (req) => {
  return await loadWithCache(cache, req.url, avgMs, errorMs, ttl);
});
