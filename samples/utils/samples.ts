import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { ICache } from '../../src/index.js';

export function load(avgMs: number, error: number = 500): Promise<{ rand: number }> {
  const randTime = (Math.random() - 0.5) * 2 * error;

  return new Promise(resolve => {
    setTimeout(() => resolve({ rand: Math.random() }), avgMs + randTime);
  });
}

export function loadWithCache(
  cache: ICache,
  key: string | undefined,
  avgMs: number,
  error?: number,
  ttl?: number,
): Promise<{ rand: number }> {
  return cache.getOrLoad(key || "sample", () => load(avgMs, error), { ttl });
}

export function httpServer(handleRequest: (req: IncomingMessage, res: ServerResponse) => Promise<any>) {
  const port = +(process.env.PORT || 8080);

  createServer((req, res) => {
    handleRequest(req, res)
      .then(data => res.end(JSON.stringify(data)))
      .catch(err => {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message, stack: err.stack }));
      });
  }).listen(port);

  console.log(`Listening on port ${port}`);
}
