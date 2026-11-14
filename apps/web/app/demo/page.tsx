import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { DemoControls } from '@/components/demo/demo-controls';

export const metadata: Metadata = { title: 'Demo controls' };

/** E7.8 / E10.5 — Demo controls: clock fast-forward, push a lab result, no-show, declined referral, channel failure, reset. */
export default function DemoPage() {
  return (
    <section>
      <PageHeader title="Demo controls" description="Make things happen and watch the loop react: new results, missed appointments, declined referrals, unreachable patients and the passing of time." />
      <DemoControls />
    </section>
  );
}
