import { Injectable, Logger } from '@nestjs/common';
import type { Channel } from '@loopclose/shared';

export interface DeliveryResult {
  status: 'sent' | 'delivered' | 'failed';
  providerRef?: string;
  error?: string;
}

export interface ChannelAdapter {
  readonly channel: Channel;
  send(to: { patientId: string; address: string }, text: string): Promise<DeliveryResult>;
}

/** Simulated adapter: records the message and optionally injects failures for the demo (E5.2). */
class SimulatedAdapter implements ChannelAdapter {
  constructor(
    readonly channel: Channel,
    private readonly failFor: Set<string>,
  ) {}
  async send(to: { patientId: string }): Promise<DeliveryResult> {
    if (this.failFor.has(to.patientId)) return { status: 'failed', error: `simulated ${this.channel} failure` };
    return { status: 'delivered', providerRef: `sim-${this.channel}-${Date.now()}` };
  }
}

@Injectable()
export class ChannelRouter {
  private readonly log = new Logger(ChannelRouter.name);
  private readonly failFor = new Set<string>();
  private readonly adapters = new Map<Channel, ChannelAdapter>();

  constructor() {
    for (const ch of ['web_chat', 'whatsapp', 'sms', 'email'] as Channel[]) {
      this.adapters.set(ch, new SimulatedAdapter(ch, this.failFor));
    }
    // TODO E11.4: if CHANNEL_WHATSAPP_MODE=twilio, replace the whatsapp adapter with a Twilio sandbox adapter.
    if (process.env.CHANNEL_WHATSAPP_MODE === 'twilio') this.log.warn('Twilio adapter not implemented yet; using simulated whatsapp');
  }

  adapter(channel: Channel): ChannelAdapter {
    const a = this.adapters.get(channel);
    if (!a) throw new Error(`No adapter for channel ${channel}`);
    return a;
  }

  /** Demo control: make the next sends to this patient fail on simulated channels (E7.8). */
  injectFailure(patientId: string, on: boolean) {
    if (on) this.failFor.add(patientId);
    else this.failFor.delete(patientId);
  }

  failing(): string[] {
    return [...this.failFor];
  }

  clearFailures() {
    this.failFor.clear();
  }
}
