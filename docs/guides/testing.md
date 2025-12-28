# Testing with Cachimbo

Since Cachimbo is designed on top of an abstraction layer for cache stores and strategies, testing your caching logic becomes straightforward. You can easily swap out different cache implementations to validate the behavior of your caching strategies under various conditions.

### Testing caching logic

Let's say you have a function that fetches user data and caches it using a Cachimbo cache:

```ts
import { ICache } from 'cachimbo';

export class UserService {
  constructor(
    private repository: UserRepository,
    private cache: ICache
  ) {}

  async getUser(userId: string): Promise<User> {
    return await this.cache.getOrLoad(
      `user:${userId}`,
      async () => await this.repository.findUserById(userId),
      { ttl: 300 } // Cache for 5 minutes
    );
  }
}
```

In your actual application, you might use a `RedisCache` or another persistent cache store. However, for testing purposes, you can use an in-memory cache like `LocalMapCache` to simulate caching behavior without external dependencies, or just a `NoOpCache` to completely bypass caching.

#### Using NoOpCache

Here's an example using Jest and the `NoOpCache` from Cachimbo to completely ignore caching during tests:

```ts
import { NoOpCache } from 'cachimbo';

test("should fetch user from repository", async () => {
  const cache = new NoOpCache();
  const service = new UserService(mockRepository, cache);

  const user = await service.getUser("1");

  expect(user).toEqual({ id: "1", name: "John Doe" });
  expect(mockRepository.findUserById).toHaveBeenCalledWith("1");
});
```

#### Using LocalMapCache

Here's an example using `LocalMapCache` from Cachimbo and Jest:

```ts
import { LocalMapCache } from 'cachimbo';

test("should fetch user from repository and cache it", async () => {
  const cache = new LocalMapCache();
  const service = new UserService(mockRepository, cache);

  const user = await service.getUser("1");

  expect(user).toEqual({ id: "1", name: "John Doe" });
  expect(mockRepository.findUserById).toHaveBeenCalledWith("1");
});

test("should skip fetching", async () => {
  const cache = new LocalMapCache();
  const service = new UserService(mockRepository, cache);
  
  await cache.set("user:1", { id: "1", name: "John Doe" });

  const user = await service.getUser("1");

  expect(user).toEqual({ id: "1", name: "John Doe" });
  expect(mockRepository.findUserById).not.toHaveBeenCalled();
});
```

By using different cache implementations, you can easily test various caching scenarios, ensuring that your caching logic behaves as expected without the overhead of setting up real cache stores during testing.

### Testing cache initialization

Let's say you have a function that initializes your cache based on environment variables:

```ts
import { ICache, RedisCache, SWRCache, NoOpCache } from 'cachimbo';
import { createClient } from '@redis/client';

export async function createCache(): Promise<ICache> {
  if (process.env.CACHE_DISABLED === 'true') {
    return new NoOpCache();
  }

  const redisClient = await createClient({
    url: process.env.REDIS_URL,
  });

  return new SWRCache({
    cache: new RedisCache({
      client: redisClient,
    }),
    defaultTTL: 60 * 15, // 15 minutes
    staleTTL: 60, // 1 minute
  });
}
```

Since Cachimbo does not initialize any external caches itself, you only need to mock the `createClient` function from the `@redis/client` package to test the cache initialization logic without connecting to a real Redis server:

```ts
import { createClient } from '@redis/client';

jest.mock("@redis/client", () => ({
  createClient: jest.fn().mockResolvedValue({ connect: jest.fn() }),
}));

test("should create NoOpCache when caching is disabled", async () => {)
  process.env.CACHE_DISABLED = 'true';

  const cache = await createCache();

  expect(cache).toBeInstanceOf(NoOpCache);
  expect(createClient).not.toHaveBeenCalled();
});

test("should create SWRCache with RedisCache when caching is enabled", async () => {)
  process.env.CACHE_DISABLED = 'false';
  process.env.REDIS_URL = 'redis://localhost:6379';

  const cache = await createCache();

  expect(cache).toBeInstanceOf(SWRCache);
  expect(createClient).toHaveBeenCalledWith({
    url: 'redis://localhost:6379',
  });
});
```
