# Hazelcast as a Cache Store

[Hazelcast](https://hazelcast.com/) is an open source, distributed in-memory data grid and key-value store.
You can self-host it or use a managed service (such as Hazelcast Cloud).

The library has built-in support for the [hazelcast-client](https://www.npmjs.com/package/hazelcast-client) through the `HazelcastCache` class.

```sh
npm install hazelcast-client
```
```ts
import { Client } from 'hazelcast-client';
import { HazelcastCache } from 'cachimbo';

const client = await Client.newHazelcastClient();
const map = await client.getMap('your-cache-name');

const hazelcastCache = new HazelcastCache({ map });
```

## Remarks

- Only the `getMany` method does a batch retrieval using Hazelcast's `getAll` method. Other methods operate on single keys.
  - `setMany` does not use Hazelcast's `setAll` as it does not support setting a TTL.
  - `deleteMany` deletes keys one by one since Hazelcast does not support batch deletion.
