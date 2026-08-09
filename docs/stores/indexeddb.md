# IndexedDB as a Cache Store

[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) is a low-level API for browser storage of significant amounts of structured data. It is supported in all modern browsers.

The library has built-in support for IndexedDB through the `IndexedDBCache` class.

```ts
import { IndexedDBCache } from 'cachimbo';

const cache = new IndexedDBCache({
  dbName: 'my-cache-db',
});

// Example usage:
const data = await cache.getOrLoad<MyData>(
  "mykey",
  () => loadData(),
);
```

## Remarks

- This cache store is designed for browser environments and will not work in Node.js since IndexedDB is a browser API.
- Expired entries are only cleaned up when they are accessed, there is no proactive cleanup. If you expect a large number of entries to expire without ever being read again, call `cache.evict()` periodically to remove them.
- IndexedDB has a [storage limit](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) that varies by browser and user settings, so it may not be suitable for caching very large amounts of data. Always consider the size of the data you are caching and the storage limits of the user's browser.
