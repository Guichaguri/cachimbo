import type { Msg, NatsConnection, Subscription } from '@nats-io/nats-core';
import { type BackplaneEvent, type BaseBackplaneOptions, BaseBackplane } from '../../base/backplane.js';

export interface NatsBackplaneOptions extends BaseBackplaneOptions {
  /**
   * The NATS connection instance.
   */
  nats: NatsConnection;

  /**
   * The backplane pub/sub subject name.
   *
   * This needs to be unique across your infrastructure to avoid collisions with other services.
   * It's recommended to name it after your application or service.
   *
   * @example 'my-app-backplane'
   */
  subject: string;
}

/**
 * A NATS backplane implementation
 */
export class NatsBackplane extends BaseBackplane {
  protected readonly nats: NatsConnection;
  protected readonly subject: string;
  protected subscription?: Subscription;

  constructor(options: NatsBackplaneOptions) {
    super(options);

    this.nats = options.nats;
    this.subject = options.subject;

    this.subscription = this.nats.subscribe(this.subject, { callback: this.onMessage });
  }

  protected onMessage = (err: Error | null, msg: Msg) => {
    if (err) {
      this.logger?.debug(this.name, '[onMessage] Unexpected error.',
        'error = ', err);
      return;
    }

    try {
      const data = msg.json<BackplaneEvent>();

      this.receiveEvent(data);
    } catch (error) {
      this.logger?.debug(this.name, '[onMessage] Failed to parse message.',
        'raw = ', msg, 'error = ', error);
    }
  };

  override async emit(data: BackplaneEvent): Promise<void> {
    this.nats.publish(this.subject, JSON.stringify(data));
  }

  override dispose(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
  }
}
