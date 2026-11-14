import type { Metadata } from 'next';
import { Worklist } from '@/components/worklist';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'Worklist' };

/** E7.2 — Coordinator worklist: programme-wide view of every open loop, sorted by SLA deadline. */
export default function CoordinatorWorklist() {
  return (
    <section>
      <PageHeader title="Worklist" description="Every actionable result that is not yet closed, ordered by what breaches next." />
      <Worklist basePath="/coordinator" />
    </section>
  );
}
