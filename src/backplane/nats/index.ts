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
 * A backplane that propagates cache updates through a NATS subject.
 *
 * Wrap the in-memory cache of each application instance with it, so writes and invalidations made by
 * one instance are applied by all the others.
 *
 * The same connection can be shared with the rest of your application, as long as the subject is unique.
 * Events are published as core NATS messages, so they are not persisted nor redelivered.
 *
 * Call {@link NatsBackplane#dispose} to unsubscribe.
 *
 * @see https://github.com/Guichaguri/cachimbo/blob/HEAD/docs/layers/backplane.md
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
    this.nodeId = this.generateNodeId();
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
