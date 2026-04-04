import type { Redis } from 'ioredis';
import type { Redis as Valkey } from 'iovalkey';
import { type BackplaneEvent, type BaseBackplaneOptions, BaseBackplane } from '../../base/backplane.js';

export interface IORedisBackplaneOptions extends BaseBackplaneOptions {
  /**
   * The ioredis or iovalkey client instance that will be used for publishing events.
   *
   * This client can be shared with any other cache store.
   */
  publishClient: Redis | Valkey;

  /**
   * The ioredis or iovalkey client instance dedicated for a subscription.
   *
   * This client has to be dedicated for subscriptions.
   * It cannot be shared with other cache stores or used for publishing events.
   */
  subscriptionClient: Redis | Valkey;

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

export class IORedisBackplane extends BaseBackplane {
  protected readonly publishClient: Redis | Valkey;
  protected readonly subscriptionClient: Redis | Valkey;
  protected readonly channel: string;

  constructor(options: IORedisBackplaneOptions) {
    super(options);

    this.publishClient = options.publishClient;
    this.subscriptionClient = options.subscriptionClient;
    this.channel = options.channel;

    this.subscriptionClient.subscribe(this.channel);
    this.subscriptionClient.on('message', this.onMessage);
  }

  protected onMessage = (channel: string, message: string) => {
    if (channel !== this.channel) {
      return;
    }

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
    this.subscriptionClient.unsubscribe(this.channel);
    this.subscriptionClient.off('message', this.onMessage);
  }
}
