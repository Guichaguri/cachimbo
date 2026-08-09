import type { RedisClientType, RedisClusterType, RedisSentinelType } from '@redis/client';
import { type BackplaneEvent, type BaseBackplaneOptions, BaseBackplane } from '../../base/backplane.js';

type Redis = RedisClientType | RedisClusterType | RedisSentinelType;

export interface RedisBackplaneOptions extends BaseBackplaneOptions {
  /**
   * The Redis client instance that will be used for publishing events.
   *
   * This client can be shared with any other cache store.
   */
  publishClient: RedisClientType | RedisClusterType | RedisSentinelType;

  /**
   * The Redis client instance dedicated for a subscription.
   *
   * This client has to be dedicated for subscriptions.
   * It cannot be shared with other cache stores or used for publishing events.
   *
   * @example `client.duplicate()`
   */
  subscriptionClient: RedisClientType | RedisClusterType | RedisSentinelType;

  /**
   * The backplane pub/sub channel name.
   *
   * This needs to be unique across your infrastructure to avoid collisions with other services.
   * It's recommended to name it after your application or service.
   *
   * @example 'my-app-backplane'
   */
  channel: string;
}

/**
 * A backplane that propagates cache updates through Redis Pub/Sub, using the node-redis client.
 *
 * Wrap the in-memory cache of each application instance with it, so writes and invalidations made by
 * one instance are applied by all the others.
 *
 * A Redis client cannot subscribe and run regular commands at the same time, so a dedicated
 * {@link RedisBackplaneOptions#subscriptionClient} is required (e.g. `client.duplicate()`).
 *
 * The subscription is created asynchronously on construction. Call {@link RedisBackplane#dispose}
 * to unsubscribe.
 *
 * @see https://github.com/Guichaguri/cachimbo/blob/HEAD/docs/layers/backplane.md
 */
export class RedisBackplane extends BaseBackplane {
  protected readonly publishClient: Redis;
  protected readonly subscriptionClient: Redis;
  protected readonly channel: string;

  constructor(options: RedisBackplaneOptions) {
    super(options);

    this.publishClient = options.publishClient;
    this.subscriptionClient = options.subscriptionClient;
    this.channel = options.channel;

    this.subscriptionClient.subscribe(this.channel, this.onMessage, false).catch(error =>
      this.logger?.debug(this.name, '[constructor] Failed to subscribe to Redis channel.', 'channel =', this.channel, 'error =', error)
    );
    this.nodeId = this.generateNodeId();
  }

  protected onMessage = (message: string) => {
    try {
      const event = JSON.parse(message) as BackplaneEvent;

      this.receiveEvent(event);
    } catch (error) {
      this.logger?.debug(this.name, '[onMessage] Failed to parse message.',
        'raw = ', message, 'error = ', error);
    }
  };

  override async emit(data: BackplaneEvent): Promise<void> {
    await this.publishClient.publish(this.channel, JSON.stringify(data));
  }

  override dispose(): void {
    this.subscriptionClient.unsubscribe(this.channel, this.onMessage as any, false);
  }
}
