import type { MqttClient } from 'mqtt';
import { type BackplaneEvent, type BaseBackplaneOptions, BaseBackplane } from '../../base/backplane.js';

export interface MqttBackplaneOptions extends BaseBackplaneOptions {
  /**
   * The mqtt client instance.
   */
  client: MqttClient;

  /**
   * The backplane pub/sub topic name.
   *
   * This needs to be unique across your infrastructure to avoid collisions with other services.
   * It's recommended to name it after your application or service.
   *
   * @example 'my-app-backplane'
   */
  topic: string;
}

/**
 * A MQTT backplane implementation
 */
export class MqttBackplane extends BaseBackplane {
  protected readonly client: MqttClient;
  protected readonly topic: string;

  constructor(options: MqttBackplaneOptions) {
    super(options);

    this.client = options.client;
    this.topic = options.topic;

    // mqtt does not return a promise here, the failure is only reported through the callback
    this.client.subscribe(this.topic, error => {
      if (error) {
        this.logger?.debug(this.name, '[constructor] Failed to subscribe to the MQTT topic.',
          'topic =', this.topic, 'error =', error);
      }
    });
    this.client.on('message', this.onMessage);
    this.nodeId = this.generateNodeId();
  }

  protected onMessage = (topic: string, event: Buffer) => {
    if (topic !== this.topic) {
      return;
    }

    try {
      const msg = event?.toString('utf8') || '';
      const data = JSON.parse(msg) as BackplaneEvent;

      this.receiveEvent(data);
    } catch (error) {
      this.logger?.debug(this.name, '[onMessage] Failed to parse message.',
        'raw = ', event, 'error = ', error);
    }
  };

  override async emit(data: BackplaneEvent): Promise<void> {
    this.client.publish(this.topic, JSON.stringify(data));
  }

  override dispose(): void {
    this.client.unsubscribe(this.topic);
    this.client.off('message', this.onMessage);
  }
}
