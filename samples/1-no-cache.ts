import { httpServer, load } from './utils/samples.js';

const avgSecs = 3; // Average time a request should take
const errorSecs = 0.5; // The amount of random error to add to the request time

httpServer(async () => {
  return await load(avgSecs, errorSecs);
});

