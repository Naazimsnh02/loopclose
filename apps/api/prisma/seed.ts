/* eslint-disable no-console */
/**
 * Seed: organisations, role users, AI feature flags. Patients/results/cases are loaded by the
 * synthetic-data seeder (E10.3) which reads analytics/output/*.ndjson. This file must stay idempotent.
 */
import { PrismaClient, OrgKind } from '@prisma/client';

const prisma = new PrismaClient();

const orgs: Array<{ id: string; name: string; kind: OrgKind }> = [
  { id: 'org-programme', name: 'Abu Dhabi Screening Programme (synthetic)', kind: 'PROGRAMME_AUTHORITY' },
  { id: 'org-lab', name: 'Central Reference Lab (synthetic)', kind: 'LAB' },
  { id: 'org-phc-1', name: 'Al Bateen Family Medicine Centre (synthetic)', kind: 'PRIMARY_CARE' },
  { id: 'org-phc-2', name: 'Khalifa City Primary Care (synthetic)', kind: 'PRIMARY_CARE' },
  { id: 'org-gi-1', name: 'City Hospital Gastroenterology (synthetic)', kind: 'SPECIALIST' },
  { id: 'org-gi-2', name: 'Corniche Endoscopy Unit (synthetic)', kind: 'SPECIALIST' },
  { id: 'org-breast-1', name: 'Breast Care Centre (synthetic)', kind: 'SPECIALIST' },
  { id: 'org-hosp-1', name: 'Tertiary Oncology Hospital (synthetic)', kind: 'HOSPITAL' },
];

const users: Array<{ id: string; email: string; displayName: string; role: string; organizationId: string; locale?: string }> = [
  { id: 'u-coord-1', email: 'coordinator@demo.loopclose', displayName: 'Mariam (Coordinator)', role: 'coordinator', organizationId: 'org-programme', locale: 'ar' },
  { id: 'u-coord-lead', email: 'coord.lead@demo.loopclose', displayName: 'Khalid (Coordinator Lead)', role: 'coordinator_lead', organizationId: 'org-programme' },
  { id: 'u-pm-1', email: 'manager@demo.loopclose', displayName: 'Dr Noura (Programme Manager)', role: 'programme_manager', organizationId: 'org-programme' },
  { id: 'u-phc-1', email: 'gp1@demo.loopclose', displayName: 'Dr Ahmed (PHC)', role: 'phc_clinician', organizationId: 'org-phc-1' },
  { id: 'u-phc-2', email: 'gp2@demo.loopclose', displayName: 'Dr Priya (PHC)', role: 'phc_clinician', organizationId: 'org-phc-2' },
  { id: 'u-phc-lead', email: 'phc.lead@demo.loopclose', displayName: 'Dr Salem (PHC Lead)', role: 'phc_lead', organizationId: 'org-phc-1' },
  { id: 'u-gi-1', email: 'gi1@demo.loopclose', displayName: 'Dr Hassan (Gastroenterology)', role: 'specialist', organizationId: 'org-gi-1' },
  { id: 'u-gi-2', email: 'gi2@demo.loopclose', displayName: 'Dr Lina (Endoscopy)', role: 'specialist', organizationId: 'org-gi-2' },
  { id: 'u-sched-1', email: 'scheduler@demo.loopclose', displayName: 'Omar (GI Scheduler)', role: 'specialist_scheduler', organizationId: 'org-gi-1' },
  { id: 'u-gi-lead', email: 'gi.lead@demo.loopclose', displayName: 'Dr Fatima (GI Lead)', role: 'specialist_lead', organizationId: 'org-gi-1' },
  { id: 'u-rad-1', email: 'radiology@demo.loopclose', displayName: 'Dr Sara (Breast Radiology)', role: 'breast_radiologist', organizationId: 'org-breast-1' },
  { id: 'u-breast-1', email: 'breast.clinic@demo.loopclose', displayName: 'Dr Layla (Breast clinic)', role: 'breast_clinic', organizationId: 'org-breast-1' },
  { id: 'u-breast-sched-1', email: 'breast.scheduler@demo.loopclose', displayName: 'Noor (Breast scheduler)', role: 'breast_clinic_scheduler', organizationId: 'org-breast-1' },
  { id: 'u-onc-1', email: 'oncology@demo.loopclose', displayName: 'Dr Yusuf (Oncology)', role: 'treating_clinician', organizationId: 'org-hosp-1' },
  { id: 'u-oncall', email: 'oncall@demo.loopclose', displayName: 'On-call Clinician', role: 'on_call_clinician', organizationId: 'org-programme' },
  { id: 'u-admin', email: 'admin@demo.loopclose', displayName: 'Platform Admin', role: 'admin', organizationId: 'org-programme' },
];

async function main() {
  for (const o of orgs) {
    await prisma.organization.upsert({ where: { id: o.id }, update: { name: o.name, kind: o.kind }, create: o });
  }
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { displayName: u.displayName, role: u.role, organizationId: u.organizationId },
      create: { ...u, locale: u.locale ?? 'en' },
    });
  }
  for (const name of ['navigator', 'summariser', 'risk']) {
    await prisma.aIFeatureFlag.upsert({ where: { name }, update: {}, create: { name, enabled: true, updatedBy: 'seed' } });
  }
  console.log(`Seeded ${orgs.length} organisations, ${users.length} users, 3 AI feature flags.`);
  console.log('Next: pnpm --filter @loopclose/api seed:synthetic (E10.3) to load patients/results/cases.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
