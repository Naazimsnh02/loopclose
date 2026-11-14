import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { PatientNavigatorDemo } from '@/components/patient/patient-navigator-demo';

export const metadata: Metadata = { title: 'Patient chat' };

/** E7.6 — Patient navigator: template-bound, multilingual (ar/en/ur/hi), teach-back, human hand-off. */
export default function PatientChat() {
  return (
    <section>
      <PageHeader
        title="Patient chat"
        description="What the patient sees, and what the navigator decided. Replies come from approved scripts in Arabic, English, Urdu and Hindi."
      />
      <PatientNavigatorDemo />
    </section>
  );
}
