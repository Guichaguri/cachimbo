# Cachimbo API Design Principles

We chose to design Cachimbo with a focus on simplicity, flexibility, and extensibility. The core of Cachimbo is the `ICache` interface, which defines the essential methods for any caching strategy. This allows developers to implement their own caching mechanisms while adhering to a consistent API.

All cache implementations in Cachimbo are asynchronous, leveraging Promises to handle operations. This design choice ensures that Cachimbo can work seamlessly with various storage backends, including in-memory caches, distributed caches, and persistent storage solutions.

The `ICache` interface includes methods for basic cache operations such as `get`, `set`, `delete`, as well as batch operations like `getMany`, `setMany`, and `deleteMany`. Additionally, the `getOrLoad` method provides a convenient way to fetch data from the cache or load it from a source if it's not present.

Cachimbo also supports cache layers, which are composable components that can be stacked to add additional behavior to cache operations. This allows for advanced caching strategies, such as stale-while-revalidate, fail-safety, and metrics collection, to be easily integrated into any cache implementation.
Cache layers are also implemented on top of the `ICache` interface, ensuring compatibility and ease of use.

By adhering to these design principles, Cachimbo provides a robust and flexible caching solution that can be tailored to meet the specific needs of different applications and use cases.

## Guidelines

1. Cache classes must implement the `ICache` interface
2. Cache classes must have the `Cache` suffix
3. Cache classes should have a constructor that accepts an options object
    - All options should be optional whenever possible, with sensible defaults
4. Cache layers should accept another `ICache` instance as the underlying cache
5. External cache stores (e.g., Redis, Memcached) should accept a client instance in the options, and not do the connecting by themselves
6. External cache stores may extend from `BaseCache` to reduce boilerplate
7. In-memory cache stores may extend from `BaseLocalCache` to reduce boilerplate and support weak caching layers
8. Cache layers should implement `ICache` directly, as they need to implement all methods properly
9. All internal methods and properties should be marked as `protected` to allow easy extension
10. Public methods outside the `ICache` interface should be avoided
11. No extra dependencies unless absolutely necessary
    - For instance, external cache layers only import the types they need from the client libraries, and not the client libraries themselves
12. Cache classes may allow an optional logger instance in the options to facilitate debugging
13. Comprehensive tests and documentation must be provided for each cache store and layer
