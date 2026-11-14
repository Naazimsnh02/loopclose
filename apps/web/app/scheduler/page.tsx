import type { Metadata } from 'next';
import { Worklist } from '@/components/worklist';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'Scheduler' };

/** E7.4 — Specialist scheduler queue: accepted referrals waiting for an appointment, no-shows to rebook. */
export default function SchedulerQueue() {
  return (
    <section>
      <PageHeader title="Scheduler queue" description="Accepted referrals waiting for a slot, and no-shows to rebook. Booking an appointment restarts the patient's clock." />
      <Worklist basePath="/scheduler" defaultTab="all" title="queue" />
    </section>
  );
}
