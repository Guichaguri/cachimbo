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
<summary><strong>Implement cache invalidation</strong></summary>

> Cache invalidation is crucial to ensure that your application serves fresh and accurate data.
>
> You can implement invalidation strategies such as:
> - **Event-driven invalidation**: invalidate or update cache entries when the underlying data changes (e.g., after a database update).
> - **Time-based expiration (TTL)**: set a short TTL data that should reflect changes quickly.
> - **Manual cache clearing**: provide mechanisms to manually clear or refresh cache entries when necessary (e.g., through an admin interface).
>
> Event-driven invalidation is generally the most effective method, as it ensures that cached data remains consistent with the source of truth. Implementing this strategy can enable longer TTLs, increasing cache hits.

</details>


<details>
<summary><strong>Always version your cache keys when using an external cache store</strong></summary>

> An external cache makes your application stateful.
> If you change the structure of the cached data, old cache entries may become incompatible with the new code, causing errors or unexpected behavior.
>
> You can avoid collisions and ensure data integrity by versioning your cache keys.
>
> This can be done by simply appending the version number to the cache key directly on the methods (e.g. `cache.get("mykey:v1")`) or by adding a [Key Transformation](../layers/key-transformation.md) layer.

</details>


<details>
<summary><strong>Always prefix your cache keys when sharing an external cache</strong></summary>

> Different applications may share the same external cache (e.g., a Redis server). This can be a problem if two applications use the same cache keys, leading to collisions and data corruption.
>
> To prevent this, add a unique prefix to your cache keys (e.g., `myapp:mykey`). You can do this manually or by using a [Key Transformation](../layers/key-transformation.md) layer.

</details>
