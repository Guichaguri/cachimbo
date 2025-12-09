import { httpServer, load } from './utils/samples.js';

const avgMs = 3000;
const errorMs = 500;

httpServer(async () => {
  return await load(avgMs, errorMs);
});

