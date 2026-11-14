import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { GovernanceConsole } from '@/components/admin/governance-console';

export const metadata: Metadata = { title: 'Governance' };

/** E7.7 / E12.3 — governance console: AI kill switches, audit trail, programme SLAs, content approvals, people. */
export default function AdminPage() {
  return (
    <section>
      <PageHeader title="Governance" description="Switch AI features off, see every AI action, and review the rules and content patients receive." />
      <GovernanceConsole />
    </section>
  );
}
