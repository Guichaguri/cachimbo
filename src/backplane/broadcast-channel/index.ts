import { type BackplaneEvent, BaseBackplane, type BaseBackplaneOptions } from '../../base/backplane.js';

export interface BroadcastChannelBackplaneOptions extends BaseBackplaneOptions {
  /**
   * The broadcast channel instance that will be used for pub/sub communication.
   *
   * This channel can be shared with any other cache store in the same browser context (e.g. other tabs).
   *
   * You can create a BroadcastChannel like this:
   *
   * ```ts
   * const channel = new BroadcastChannel('my-app-backplane');
   * const cache = new BroadcastChannelBackplane({ channel, cache: localCache });
   * ```
   */
  channel: BroadcastChannel;
}

interface BroadcastBackplaneEvent {
  t: 'bkpln' | string;
  e: BackplaneEvent;
}

/**
 * A BroadcastChannel based backplane for the web.
 * This backplane shares cache updates with other browser tabs
 */
export class BroadcastChannelBackplane extends BaseBackplane {
  protected readonly channel: BroadcastChannel;

  constructor(options: BroadcastChannelBackplaneOptions) {
    super(options);

    this.channel = options.channel;

    this.channel.addEventListener('message', this.onMessage);
  }

  protected onMessage = (event: MessageEvent<BroadcastBackplaneEvent>) => {
    if (typeof event.data !== 'object' || event.data.t !== 'bkpln') {
      return;
    }

    this.receiveEvent(event.data.e);
  };

  override async emit(event: BackplaneEvent): Promise<void> {
    this.channel.postMessage({ t: 'bkpln', e: event } satisfies BroadcastBackplaneEvent);
  }

  override dispose(): void {
    this.channel.removeEventListener('message', this.onMessage);
  }
}
