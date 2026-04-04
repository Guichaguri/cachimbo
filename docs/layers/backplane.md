# Backplane

The backplane cache layer enables multiple instances of your application to sync their in-memory cache invalidation events. Everytime you update an item in one instance, an event is propagated to all other instances updating their in-memory caches properly.

This is particularly useful in distributed systems where you have several instances running behind a load balancer, and you want to ensure that when one instance updates or invalidates a cache entry, all other instances are aware of this change.

The propagation can be done through various pub-sub backends, such as Redis, Valkey or MQTT.

There are two modes supported for propagating cache updates:
- **Active**: when an instance updates an item, the payload is sent to the backplane and all other instances receive the event and update their cache accordingly.
- **Lazy**: when an instance updates an item, it only updates its local cache and sends a notification to the backplane. Other instances receive the notification and invalidate the corresponding cache entry, so the next time they try to access it, they will fetch the updated value from the original data source.

Prefer using the lazy mode if you have a [Tiered Cache](./tiered.md) with a remote cache as the last layer, so you can avoid the overhead of updating the local cache in all instances and still ensure cache consistency across the system.

This layer is based on [FusionCache's Backplane](https://github.com/ZiggyCreatures/FusionCache/blob/main/docs/Backplane.md) feature.

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
  mode: 'active', // or 'lazy', depending on your needs
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
  mode: 'active', // or 'lazy', depending on your needs
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
  mode: 'active', // or 'lazy', depending on your needs
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
