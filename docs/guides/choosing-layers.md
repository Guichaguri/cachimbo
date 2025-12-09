# Choosing the Right Combination of Layers

When building a caching solution with Cachimbo, selecting the appropriate combination of layers is crucial to meet your application's performance and reliability needs. Here are some guidelines to help you choose the right layers:

1. **Understand Your Access Patterns**
   - Analyze how your application accesses data. Identify frequently accessed items, read/write ratios, latency requirements and amount of cached resources. This understanding will guide your layer selection.
2. **Start with Basic Caching**
   - Begin with a simple in-memory cache layer for low-latency access to frequently requested data. This layer can significantly reduce response times for common queries.
3. **Add a Distributed Cache for Scalability**
   - If you have many application instances, or many resources to cache, consider adding a distributed cache layer (e.g., Redis or Memcached) to share cached data across instances as well as enabling more memory to be cached.
4. **Add Request Coalescing for High Traffic**
   - If your application experiences bursts of traffic or has many concurrent requests for the same resource, consider adding a Request Coalescing layer. This layer will deduplicate requests, reducing load on your backend services.
5. **Implement Stale-While-Revalidate for Freshness**
   - To balance freshness and performance, use the Stale-While-Revalidate layer. This layer allows serving stale data while asynchronously updating the cache, ensuring low latency even during cache refreshes.
6. **Use Tiered Caching for Multi-Level Storage**
   - For applications with diverse access patterns, implement a Tiered Caching layer. This allows you to combine multiple cache stores (e.g., in-memory, Redis) to optimize for both speed and capacity.
7. **Incorporate Metrics Collection for Monitoring**
   - Add a Metrics Collection layer to monitor cache performance, hit/miss rates, and latency. This data is invaluable for tuning your caching strategy over time.
8. **Consider Your Infrastructure**
   - Evaluate your existing infrastructure and choose layers that integrate well with your current systems. For example, if you already use Redis, leveraging it in your caching layers can simplify implementation.
9. **Test and Iterate**
   - Implement your chosen layers and monitor their performance. Use the collected metrics to identify bottlenecks and adjust your caching strategy as needed. Caching is often an iterative process.

## Good Practices

<details>
<summary><strong>Not everything needs to be cached</strong></summary>

> Before caching a resource, evaluate whether it truly benefits from caching. Consider the following:
> - Cache expensive operations, not everything.
>   - e.g., heavy DB queries, external API calls, large computations.
> - Cache only data that is read frequently.
> - Avoid caching data that changes constantly unless you have strong consistency requirements.
> 
> In short, cache read-heavy, stable, or slow-to-compute data.

</details>

<details>
<summary><strong>Implement cache invalidation</strong></summary>

> Cache invalidation is crucial to ensure that your application serves fresh and accurate data.
>
> | Strategy                  | How                                                            | Pros                                                                             | Cons                                                                                |
> |---------------------------|----------------------------------------------------------------|----------------------------------------------------------------------------------|-------------------------------------------------------------------------------------|
> | Event-driven invalidation | Delete/update cache entries when the data changes.             | Ensures cache consistency with the source of truth; Can also allow a longer TTL. | Needs logic to be triggered whenever the data is updated.                           |
> | Time-based expiration     | Set short TTL values for cache entries.                        | Improves performance with no further development needed.                         | Takes at least the TTL value to refresh the data; Can increase the cache miss rate. |
> | Manual cache clearing     | Implement admin tools or APIs to clear specific cache entries. | Provides control over cache state when needed.                                   | Not automatic.                                                                      |
>
> Event-driven invalidation is generally the bulletproof method, as it ensures that cached data remains consistent with the source of truth. Implementing this strategy can enable longer TTLs, increasing cache hits.

</details>


<details>
<summary><strong>Add a version your cache keys when using an external cache store</strong></summary>

> Fact: An external cache makes your application stateful.
> 
> If you change the structure of the cached data, old cache entries become incompatible with the new code, causing errors or unexpected behavior.
>
> You can avoid collisions and ensure data integrity by versioning your cache keys.
>
> This can be done by simply appending the version number to the cache key directly on the methods (e.g. `cache.get("mykey:v1")`) or by adding a [Key Transformation](../layers/key-transformation.md) layer.

</details>


<details>
<summary><strong>Prefix your cache keys when sharing an external cache</strong></summary>

> Different applications may share the same external cache (e.g., a Redis server). This can be a problem if two applications use the same cache keys, leading to collisions and data corruption.
>
> To prevent this, add a unique prefix to your cache keys (e.g., `myapp:mykey`). You can do this manually or by using a [Key Transformation](../layers/key-transformation.md) layer.

</details>


<details>
<summary><strong>Don't overengineer the cache layers</strong></summary>

> The cache layers can greatly enhance your application's performance, but they can also hurt it.
>
> For example, a Tiered Cache can improve server round-trips with an in-memory cache in front of an external cache, but it also increases memory usage and adds additional overhead.
> If your external cache has already a ultra low latency, adding a Tiered Cache layer will hurt performance.
>
> In short, don't try to solve problems you don't have.
>
> If you don't know whether a layer is useful for your application, start with and without it and measure the performance.

</details>
