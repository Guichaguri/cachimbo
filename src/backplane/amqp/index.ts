import type { Channel, ChannelModel, ConsumeMessage, RecoveringChannelModel } from 'amqplib';
import { type BackplaneEvent, type BaseBackplaneOptions, BaseBackplane } from '../../base/backplane.js';

export interface AmqpBackplaneOptions extends BaseBackplaneOptions {
  /**
   * The AMQP connection instance.
   */
  connection: ChannelModel | RecoveringChannelModel;

  /**
   * The backplane AMQP exchange.
   *
   * This needs to be unique across your infrastructure to avoid collisions with other services.
   * It's recommended to name it after your application or service.
   *
   * @example 'my-app-backplane'
   */
  exchange: string;
}

/**
 * An AMQP backplane implementation
 */
export class AmqpBackplane extends BaseBackplane {
  protected readonly connection: ChannelModel | RecoveringChannelModel;
  protected readonly exchange: string;
  protected readonly ready: Promise<void>;
  protected channel?: Channel;
  protected consumerTag?: string;

  constructor(options: AmqpBackplaneOptions) {
    super(options);

    this.connection = options.connection;
    this.exchange = options.exchange;

    this.ready = this.initialize();
  }

  protected async initialize(): Promise<void> {
    try {
      const channel = this.channel = await this.connection.createChannel();
      await channel.assertExchange(this.exchange, 'fanout', { durable: false });
      const { queue } = await channel.assertQueue('', { durable: false, autoDelete: true });
      const { consumerTag } = await channel.consume(queue, this.onMessage, { noAck: true, noLocal: true });

      await channel.bindQueue(queue, this.exchange, '');

      this.consumerTag = consumerTag;
      this.nodeId = consumerTag;
    } catch (error) {
      this.logger?.debug(this.name, '[initialize] Failed to initialize the pub/sub.',
        'error = ', error);
    }
  }

  protected async close(): Promise<void> {
    if (!this.channel) {
      return;
    }

    if (this.consumerTag) {
      await this.channel.cancel(this.consumerTag);
    }
    await this.channel.close();

    this.channel = undefined;
    this.consumerTag = undefined;
  }

  protected onMessage = (message: ConsumeMessage | null) => {
    if (message === null) {
      return;
    }

    try {
      const msg = message.content.toString('utf8');
      const data = JSON.parse(msg) as BackplaneEvent;

      this.receiveEvent(data);
    } catch (error) {
      this.logger?.debug(this.name, '[onMessage] Failed to parse message.',
        'raw = ', message, 'error = ', error);
    }
  };

  override async emit(data: BackplaneEvent): Promise<void> {
    // The channel is created asynchronously, so without waiting here every event
    // published right after construction would be silently dropped
    await this.ready;

    if (!this.channel) {
      this.logger?.debug(this.name, '[emit] The channel is not available, the event was not published.',
        'data =', data);
      return;
    }

    this.channel.publish(this.exchange, '', Buffer.from(JSON.stringify(data), 'utf8'));
  }

  override dispose(): void {
    this.ready
      .then(() => this.close())
      .catch(error =>
        this.logger?.debug(this.name, '[dispose] Failed to close the channel.', 'error =', error)
      );
  }
}
