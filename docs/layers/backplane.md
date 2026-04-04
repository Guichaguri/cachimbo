# Backplane

The backplane cache layer enables multiple instances of your application to sync their in-memory cache invalidation events. Everytime you update an item in one instance, this become an event that will be propagated to all instances, so all of them will update it too.

This is particularly useful in distributed systems where you have several instances running behind a load balancer, and you want to ensure that when one instance updates or invalidates a cache entry, all other instances are aware of this change.

The propagation can be done through various pub-sub backends, such as Redis, Valkey or MQTT.

This layer was based on [FusionCache's Backplane](https://github.com/ZiggyCreatures/FusionCache/blob/main/docs/Backplane.md) feature.

### ioredis / iovalkey

```sh
npm install ioredis # if you want to use Redis
# or
npm install iovalkey # if you want to use Valkey
```
```ts
import Redis from 'ioredis'; // or import Valkey from 'iovalkey';
import { IORedisBackplane } from 'cachimbo';

const redisClient = new Redis("redis://user:password@localhost:6379");

const cacheWithBackplane = new IORedisBackplane({
  publishClient: redisClient,
  subscriptionClient: redisClient.duplicate(), // redis requires a decidated client for subscriptions
  channel: 'my-cool-app-backplane', // this should be unique across your organization to avoid collisions with other applications using the same Redis instance
  cache: new LocalTTLCache(), // this can be any in-memory cache
});

// This will set the value in the local cache and publish an update event to other instances
await cacheWithBackplane.set("key", "value");
```

### node-redis

```sh
npm install @redis/client
```
```ts
import { createClient } from '@redis/client';
import { RedisBackplane } from 'cachimbo';

const redisClient = await createClient({
  url: "redis://user:password@localhost:6379",
});

await redisClient.connect();

const cacheWithBackplane = new RedisBackplane({
  publishClient: redisClient,
  subscriptionClient: redisClient.duplicate(), // redis requires a decidated client for subscriptions
  channel: 'my-cool-app-backplane', // this should be unique across your organization to avoid collisions with other applications using the same Redis instance
  cache: new LocalTTLCache(), // this can be any in-memory cache
});

// This will set the value in the local cache and publish an update event to other instances
await cacheWithBackplane.set("key", "value");
```

### mqtt

```sh
npm install mqtt
```

```ts
import { connect } from 'mqtt';
import { MqttBackplane } from 'cachimbo';

const mqtt = connect(process.env.MQTT_URL || 'mqtt://localhost:1883');

const cacheWithBackplane = new MqttBackplane({
  client: mqtt,
  topic: 'my-cool-app-backplane', // this should be unique across your organization to avoid collisions with other applications using the same MQTT instance
  cache: new LocalTTLCache(), // this can be any in-memory cache
});

// This will set the value in the local cache and publish an update event to other instances
await cacheWithBackplane.set("key", "value");
```

## Caveats

- There might be a slight delay between the time an entry is invalidated in one instance and the time other instances receive the invalidation event, depending on the backplane server's performance.
- Make sure to handle potential connection issues with the backplane store gracefully to avoid losing invalidation events.
- The backplane layer introduces additional network overhead due to the pub/sub communication. Evaluate the performance impact in your specific use case.
- When using the backplane layer, ensure that all instances of your application are configured to use the same backplane store to maintain consistency across the distributed system.
- A Redis client can only be used for either pub-sub or regular cache operations, but not both. If you're using Redis as your backplane, make sure to create separate clients for publishing and subscribing to avoid connection issues.
