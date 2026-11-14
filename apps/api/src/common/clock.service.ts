import { Injectable } from '@nestjs/common';

/**
 * Single source of "now". In demo mode an offset can be applied so SLA breaches can be
 * demonstrated deterministically (E10.5). Disabled when NODE_ENV=production.
 */
@Injectable()
export class ClockService {
  private offsetMs = Number(process.env.DEMO_CLOCK_OFFSET_HOURS ?? 0) * 3_600_000;

  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }

  setOffsetHours(hours: number) {
    if (process.env.NODE_ENV === 'production') throw new Error('Clock offset is disabled in production');
    this.offsetMs = hours * 3_600_000;
  }

  offsetHours(): number {
    return this.offsetMs / 3_600_000;
  }
}
