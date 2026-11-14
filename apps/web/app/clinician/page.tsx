import type { Metadata } from 'next';
import { Worklist } from '@/components/worklist';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'Clinician inbox' };

/** E7.3 — Clinician inbox. The API scopes non-programme roles to cases owned by their organisation. */
export default function ClinicianInbox() {
  return (
    <section>
      <PageHeader title="Clinician inbox" description="Cases your organisation owns right now: consults to complete, referrals to accept, results to act on." />
      <Worklist basePath="/clinician" defaultTab="all" title="inbox" />
    </section>
  );
}
