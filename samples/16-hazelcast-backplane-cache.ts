// Play with these variables and see how it affects caching behavior
// All variables are in seconds

const avgSecs = 3; // Average time a request should take
const errorSecs = 0.5; // The amount of random error to add to the request time
const ttl = 10; // The amount of time items should remain cached

// ---

import { httpServer, loadWithCache } from './utils/samples.js';
import { Client } from 'hazelcast-client';
import { LocalTTLCache, HazelcastBackplane } from '../src/index.js';

const client = await Client.newHazelcastClient({
  clusterName: 'dev',
  network: {
    clusterMembers: [
      process.env.HAZELCAST_ADDRESS || 'localhost:5701',
    ]
  },
});

const topic = await client.getReliableTopic('sample-backplane');

const cache = new HazelcastBackplane({
  cache: new LocalTTLCache(),
  topic: topic,
});

httpServer(async (req) => {
  return await loadWithCache(cache, req.url, avgSecs, errorSecs, ttl);
});
