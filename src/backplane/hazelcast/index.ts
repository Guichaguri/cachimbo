import type { ITopic, Message } from 'hazelcast-client';
import { type BackplaneEvent, type BaseBackplaneOptions, BaseBackplane } from '../../base/backplane.js';

export interface HazelcastBackplaneOptions extends BaseBackplaneOptions {
  /**
   * Hazelcast topic instance.
   *
   * Obtain it through a Hazelcast client:
   *
   * ```ts
   * import { Client } from 'hazelcast-client';
   *
   * const client = await Client.newHazelcastClient();
   * const topic = await client.getReliableTopic('my-backplane');
   *
   * const cache = new HazelcastBackplane({ topic, cache: localCache });
   * ```
   */
  topic: ITopic<any>;
}

/**
 * A backplane that propagates cache updates through a Hazelcast topic.
 *
 * Wrap the in-memory cache of each application instance with it, so writes and invalidations made by
 * one instance are applied by all the others.
 *
 * A reliable topic (`client.getReliableTopic()`) is recommended, as a plain topic may drop messages.
 *
 * Call {@link HazelcastBackplane#dispose} to remove the message listener.
 *
 * @see https://github.com/Guichaguri/cachimbo/blob/HEAD/docs/layers/backplane.md
 */
export class HazelcastBackplane extends BaseBackplane {
  protected readonly topic: ITopic<BackplaneEvent>;
  protected listenerId?: string;

  constructor(options: HazelcastBackplaneOptions) {
    super(options);

    this.topic = options.topic;

    this.listenerId = this.topic.addMessageListener(this.onMessage);
    this.nodeId = this.listenerId;
  }

  protected onMessage = (event: Message<BackplaneEvent>) => {
    this.receiveEvent(event.messageObject);
  };

  override async emit(data: BackplaneEvent): Promise<void> {
    await this.topic.publish(data);
  }

  override dispose(): void {
    if (this.listenerId) {
      this.topic.removeMessageListener(this.listenerId);
      this.listenerId = undefined;
    }
  }
}
