# Backplane

The backplane cache layer enables multiple instances of your application to sync their in-memory cache invalidation events. Every time you update an item in one instance, an event is propagated to all other instances, which update their in-memory caches accordingly.

This is particularly useful in distributed systems where you have several instances running behind a load balancer, and you want to ensure that when one instance updates or invalidates a cache entry, all other instances are aware of this change.

The propagation can be done through various pub-sub backends, such as Redis, Valkey, MQTT, AMQP (RabbitMQ), Hazelcast and NATS. In browsers, a `BroadcastChannel` can be used to sync multiple tabs of the same application.

There are two modes supported for propagating cache updates:
- **Active**: when an instance updates an item, the payload is sent to the backplane and all other instances receive the event and update their cache accordingly.
- **Lazy**: when an instance updates an item, it only updates its local cache and sends a notification to the backplane. Other instances receive the notification and invalidate the corresponding cache entry, so the next time they try to access it, they will fetch the updated value from the original data source.

The trade-off is between network traffic and cache misses: the active mode keeps every instance warm at the cost of sending the whole payload to all of them, while the lazy mode only sends the key and lets each instance reload the value if it ever needs it.

Prefer using the lazy mode if you have a [Tiered Cache](./tiered.md) with a remote cache as the last tier, since the other instances can reload the value from the shared cache instead of the original data source, which makes the extra payload unnecessary.

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
  subscriptionClient: redisClient.duplicate(), // redis requires a dedicated client for subscriptions
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

const redisClient = createClient({
  url: "redis://user:password@localhost:6379",
});

await redisClient.connect();

const cacheWithBackplane = new RedisBackplane({
  publishClient: redisClient,
  subscriptionClient: redisClient.duplicate(), // redis requires a dedicated client for subscriptions
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

const mqtt = connect('mqtt://localhost:1883');

const cacheWithBackplane = new MqttBackplane({
  client: mqtt,
  topic: 'my-cool-app-backplane', // this should be unique across your organization to avoid collisions with other applications using the same MQTT instance
  mode: 'active', // or 'lazy', depending on your needs
  cache: new LocalTTLCache(), // this can be any in-memory cache
});

// This will set the value in the local cache and publish an update event to other instances
await cacheWithBackplane.set("key", "value");
```

### amqplib

RabbitMQ, Apache ActiveMQ, and other AMQP-based message brokers.

```sh
npm install amqplib
```

```ts
import { connect } from 'amqplib';
import { AmqpBackplane } from 'cachimbo';

const amqpConnection = await connect('amqp://rabbitmq:rabbitmq@localhost:5672');

const cacheWithBackplane = new AmqpBackplane({
  connection: amqpConnection,
  mode: 'active', // or 'lazy', depending on your needs
  exchange: 'sample-backplane', // this should be unique across your organization to avoid collisions with other applications using the same RabbitMQ instance
  cache: new LocalTTLCache(), // this can be any in-memory cache
});

// This will set the value in the local cache and publish an update event to other instances
await cacheWithBackplane.set("key", "value");
```

### Hazelcast

```sh
npm install hazelcast-client
```

```ts
import { Client } from 'hazelcast-client';
import { HazelcastBackplane } from 'cachimbo';

const client = await Client.newHazelcastClient();
const topic = await client.getReliableTopic('my-cool-app-backplane'); // this should be unique across your organization to avoid collisions with other applications using the same Hazelcast instance

const cacheWithBackplane = new HazelcastBackplane({
  topic: topic,
  mode: 'active', // or 'lazy', depending on your needs
  cache: new LocalTTLCache(), // this can be any in-memory cache
});

// This will set the value in the local cache and publish an update event to other instances
await cacheWithBackplane.set("key", "value");
```

### NATS

```sh
npm install @nats-io/transport-node
```

```ts
import { connect } from '@nats-io/transport-node';
import { NatsBackplane } from 'cachimbo';

const nats = await connect({ servers: "demo.nats.io:4222" });

const cacheWithBackplane = new NatsBackplane({
  nats: nats,
  subject: 'my-cool-app-backplane', // this should be unique across your organization to avoid collisions with other applications using the same NATS instance
  mode: 'active', // or 'lazy', depending on your needs
  cache: new LocalTTLCache(), // this can be any in-memory cache
});

// This will set the value in the local cache and publish an update event to other instances
await cacheWithBackplane.set("key", "value");
```

### BroadcastChannel (for browsers)

BroadcastChannel is a browser API that allows communication between different tabs or windows of the same origin. This can be used as a backplane for synchronizing in-memory caches across multiple tabs of a web application.

```ts
import { BroadcastChannelBackplane } from 'cachimbo';

const cacheWithBackplane = new BroadcastChannelBackplane({
  channel: new BroadcastChannel('my-cool-app-backplane'), // this should be unique across your app to avoid collisions with other channels
  cache: new LocalTTLCache(), // this can be any in-memory cache
});

// This will set the value in the local cache and publish an update event to other browser tabs
await cacheWithBackplane.set("key", "value");
```

## Caveats

- There might be a slight delay between the time an entry is invalidated in one instance and the time other instances receive the invalidation event, depending on the backplane server's performance. Keep in mind that in this short period of time, different instances might have inconsistent cache states.
- Make sure to handle potential connection issues with the backplane store gracefully to avoid losing invalidation events.
- A failure to publish an event does **not** fail the cache operation. The local cache has already been updated at that point, so failing the whole operation would make the cache less reliable than not having a backplane at all. The failure is reported through the `logger`, and the nodes may hold different values until the next update of that key. Pass a `logger` to detect it.
- A Redis client can only be used for either pub-sub or regular cache operations, but not both. If you're using Redis as your backplane, you will have to create separate clients for publishing and subscribing.
- Once you're done using a backplane, call `dispose()` to remove the internal listeners
