import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { ICache } from '../../src/index.js';

export function load(avgSecs: number, errorSecs: number = 0.5): Promise<{ rand: number }> {
  const randTime = (Math.random() - 0.5) * 2 * errorSecs;

  return new Promise(resolve => {
    setTimeout(() => resolve({ rand: Math.random() }), (avgSecs + randTime) * 1000);
  });
}

export function loadWithCache(
  cache: ICache,
  key: string | undefined,
  avgSecs: number,
  errorSecs?: number,
  ttl?: number,
  options: object = {},
): Promise<{ rand: number }> {
  return cache.getOrLoad(key || "sample", () => load(avgSecs, errorSecs), { ttl, ...options });
}

export function httpServer(handleRequest: (req: IncomingMessage, res: ServerResponse) => Promise<any>) {
  const port = +(process.env.PORT || 8080);

  createServer((req, res) => {
    handleRequest(req, res)
      .then(data => res.end(JSON.stringify(data)))
      .catch(err => {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message, stack: err.stack }, null, 4));
      });
  }).listen(port);

  console.log(`Listening on port ${port}`);
}
