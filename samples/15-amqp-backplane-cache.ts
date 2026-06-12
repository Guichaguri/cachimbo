// Play with these variables and see how it affects caching behavior
// All variables are in seconds

const avgSecs = 3; // Average time a request should take
const errorSecs = 0.5; // The amount of random error to add to the request time
const ttl = 10; // The amount of time items should remain cached

// ---

import { httpServer, loadWithCache } from './utils/samples.js';
import { connect } from 'amqplib';
import { LocalTTLCache, AmqpBackplane } from '../src/index.js';

const connection = await connect(process.env.AMQP_URL || 'amqp://rabbitmq:rabbitmq@localhost:5672');

const cache = new AmqpBackplane({
  cache: new LocalTTLCache(),
  connection: connection,
  exchange: 'sample-backplane',
});

httpServer(async (req) => {
  return await loadWithCache(cache, req.url, avgSecs, errorSecs, ttl);
});
