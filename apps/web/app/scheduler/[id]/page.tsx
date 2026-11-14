import { CaseDetailView } from '@/components/case/case-detail-view';

export default async function SchedulerCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CaseDetailView id={id} backHref="/scheduler" />;
}
