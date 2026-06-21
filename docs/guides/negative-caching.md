# Negative Caching

[Negative caching](https://en.wikipedia.org/wiki/Negative_cache) is a technique used to improve the performance by caching negative responses, such as "Not Found". This allows your application to avoid making repeated queries for the same resource, which can save time and reduce network traffic.

For example, think of a blog website. In a traditional caching approach, if a user requests a blog post that does not exist, the application would query the database, find that the post is not there, and return a "Not Found" response. If another user requests the same non-existent post shortly after, the application would repeat the same process, resulting in unnecessary database queries. With negative caching, when the first user requests the non-existent post, the application can cache the "Not Found" response. Then, when the second user requests the same post, the application can quickly return the cached "Not Found" response without hitting the database again.

In Cachimbo, you can implement negative caching by saving a special value in the cache to indicate that error. For example, you can return a specific object or a string that represents the error state. When you check the cache, you can then determine if the value indicates a successful load or a negative cache entry.

Here's an example:

```ts
type BlogPostResult = 
  | { status: 'success'; value: BlogPost } // Represents a successful load with the cached value
  | { status: 'not-found' }; // Represents a negative cache entry for a not found resource

const data = await cache.getOrLoad<BlogPostResult>(
  `blog-post-${id}`, // Cache key for the blog post
  async (context) => {
    const post = await findBlogPost(id);

    if (post === null) {
      // Instead of throwing an error, return a special value to indicate that the resource was not found
      context.options.ttl = 60; // cache this key for only one minute
      return { status: 'not-found' };
    }

    return { status: 'success', value: post };
  },
  { ttl: 60 * 15 } // Cache for 15 minutes by default
);

if (data.status === 'success') {
  // Use data.value
} else if (data.status === 'not-found') {
  // Handle not found case
}
```

You can also cache internal errors to prevent repeated attempts to load a resource that is currently experiencing issues. For example, if your database is down, you can cache an error response for a short period of time to avoid overwhelming the database with requests.

```ts
const data = await cache.getOrLoad<BlogPostResult>(
  `blog-post-${id}`,
  async (context) => {
    try {
      const post = await findBlogPost(id);

      return { status: 'success', value: post };
    } catch (error) {
      // Cache the error response for a short period of time to prevent repeated attempts
      context.options.ttl = 30; // cache this key for only 30 seconds
      return { status: 'internal-error', error: error.message };
    }
  },
  { ttl: 60 * 15 } // Cache for 15 minutes by default
);
```
