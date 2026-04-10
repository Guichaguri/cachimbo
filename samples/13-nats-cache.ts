// Play with these variables and see how it affects caching behavior
// All variables are in seconds

const avgSecs = 3; // Average time a request should take
const errorSecs = 0.5; // The amount of random error to add to the request time
const ttl = 10; // The amount of time items should remain cached
const bucketName = 'mycoolcache'; // If the TTL changes, this name has to be changed as well to avoid conflicts

// ---

import { httpServer, loadWithCache } from './utils/samples.js';
import { connect } from '@nats-io/transport-node';
import { Kvm } from '@nats-io/kv';
import { AsyncLazyCache, NatsCache } from '../src/index.js';

const cache = new AsyncLazyCache({
  factory: async () => {
    const nc = await connect({ servers: process.env.NATS_URL || 'nats://localhost:4222' });
    const kvm = new Kvm(nc);

    const kv = await kvm.create(bucketName, {
      storage: 'memory',
      ttl: ttl * 1000,
      history: 0,
    });

    return new NatsCache({ kv });
  },
});

httpServer(async (req) => {
  return await loadWithCache(cache, req.url, avgSecs, errorSecs);
});
