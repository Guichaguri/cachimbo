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
 * A Hazelcast topic backplane implementation
 */
export class HazelcastBackplane extends BaseBackplane {
  protected readonly topic: ITopic<BackplaneEvent>;
  protected listenerId?: string;

  constructor(options: HazelcastBackplaneOptions) {
    super(options);

    this.topic = options.topic;

    this.listenerId = this.topic.addMessageListener(this.onMessage);
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
