/**
 * E10.3 — Loads the synthetic population produced by `lc-analytics synthetic` and drives every
 * actionable result through the REAL intake + case engine, back-dated with the demo clock, so the
 * worklist, SLA states, escalations, FHIR projection and dashboard all have believable history.
 *
 * Usage: pnpm --filter @loopclose/api seed:synthetic [--limit 120] [--seed 7]
 * Requires: `pnpm seed` already run (orgs/users); Postgres up. HAPI optional (outbox drains later).
 */
import 'reflect-metadata';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { Actor, CaseSnapshot, Owner } from '@loopclose/shared';
import type { DiagnosticReport } from 'fhir/r4';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma.service';
import { ClockService } from '../src/common/clock.service';
import { ProgrammeRegistry } from '../src/common/programme-registry.service';
import { CasesService } from '../src/modules/cases/cases.service';
import { IntakeService } from '../src/modules/integration/intake.service';

process.env.JOBS_WORKERS_DISABLED = 'true'; // enqueue timers, but let the running API process them

const OUT = resolve(__dirname, '../../../analytics/output');
const args = new Map(process.argv.slice(2).map((a, i, all) => [a, all[i + 1]] as const));
const LIMIT = Number(args.get('--limit') ?? 150);
const SEED = Number(args.get('--seed') ?? 7);

type SynPatient = { fhirId: string; givenName: string; familyName: string; birthDate: string; sex: string; nationality: string; preferredLocale: string; phone: string; distanceKm: number; transportBarrier: boolean; priorNoShows: number };
type SynResult = { externalId: string; programmeId: string; patientFhirId: string; loincCode: string; valueText: string; actionable: boolean; flags: string[]; issuedAt: string };

// Deterministic PRNG so demo data is reproducible across resets.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const pick = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]!;
const chance = (p: number) => rnd() < p;

const ARABIC_F = ['Fatima', 'Mariam', 'Aisha', 'Noura', 'Hessa', 'Shamma', 'Latifa', 'Moza'];
const ARABIC_M = ['Mohammed', 'Ahmed', 'Khalid', 'Saeed', 'Hamad', 'Rashid', 'Omar', 'Sultan'];
const URDU = ['Ayesha', 'Bilal', 'Sana', 'Imran', 'Hina', 'Faisal'];
const HINDI = ['Priya', 'Rahul', 'Anita', 'Vikram', 'Kavita', 'Suresh'];
const EN = ['Grace', 'Daniel', 'Maria', 'Jose', 'Angela', 'Mark'];
const FAMILY: Record<string, string[]> = {
  ar: ['Al Mazrouei', 'Al Ketbi', 'Al Hashimi', 'Al Suwaidi', 'Hassan', 'Ibrahim'],
  ur: ['Khan', 'Malik', 'Siddiqui', 'Qureshi'],
  hi: ['Sharma', 'Patel', 'Nair', 'Reddy'],
  en: ['Santos', 'Reyes', 'Smith', 'Okafor'],
};
function nameFor(p: SynPatient) {
  const given = p.preferredLocale === 'ar' ? pick(p.sex === 'female' ? ARABIC_F : ARABIC_M) : p.preferredLocale === 'ur' ? pick(URDU) : p.preferredLocale === 'hi' ? pick(HINDI) : pick(EN);
  return { given, family: pick(FAMILY[p.preferredLocale] ?? FAMILY.en!) };
}

/** Target end-state distribution for the demo cohort (roughly the pathway funnel). */
const TARGETS: Array<[string, number]> = [
  ['result_issued', 0.08],
  ['patient_notified', 0.12],
  ['patient_acknowledged', 0.12],
  ['consult_done', 0.08],
  ['referral_sent', 0.1],
  ['referral_accepted', 0.08],
  ['appointment_booked', 0.14],
  ['confirmatory_done', 0.06],
  ['treatment_or_surveillance', 0.04],
  ['closed', 0.1],
  ['declined_by_patient', 0.03],
  ['lost_to_follow_up', 0.05],
];
function pickTarget(): string {
  let r = rnd();
  for (const [s, p] of TARGETS) {
    if ((r -= p) <= 0) return s;
  }
  return 'appointment_booked';
}

async function main() {
  for (const f of ['patients.ndjson', 'results.ndjson']) {
    if (!existsSync(resolve(OUT, f))) throw new Error(`Missing ${f}. Run: cd analytics && lc-analytics synthetic`);
  }
  const patients: SynPatient[] = readFileSync(resolve(OUT, 'patients.ndjson'), 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
  const results: SynResult[] = readFileSync(resolve(OUT, 'results.ndjson'), 'utf-8').trim().split('\n').map((l) => JSON.parse(l));

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const clock = app.get(ClockService);
  const programmes = app.get(ProgrammeRegistry);
  const cases = app.get(CasesService);
  const intake = app.get(IntakeService);

  const users = await prisma.user.findMany();
  const byRole = (role: string) => users.filter((u) => u.role === role);
  const ownerFor = (role: string): Owner => {
    const u = pick(byRole(role));
    if (!u) throw new Error(`No seeded user with role ${role}`);
    return { id: u.id, role: u.role, organizationId: u.organizationId };
  };
  const actorFor = (owner: Owner): Actor => ({ kind: 'human', id: owner.id, role: owner.role, organizationId: owner.organizationId });

  // 1) Patients (upsert; realistic names per locale)
  const patientMap = new Map(patients.map((p) => [p.fhirId, p]));
  const actionable = results.filter((r) => r.actionable).slice(0, LIMIT);
  const neededPatients = new Set(actionable.map((r) => r.patientFhirId));
  for (const p of patients.filter((p) => neededPatients.has(p.fhirId))) {
    const n = nameFor(p);
    await prisma.patient.upsert({
      where: { fhirId: p.fhirId },
      create: { fhirId: p.fhirId, givenName: n.given, familyName: n.family, birthDate: new Date(p.birthDate), sex: p.sex, nationality: p.nationality, preferredLocale: p.preferredLocale, phone: p.phone, distanceKm: p.distanceKm, transportBarrier: p.transportBarrier, priorNoShows: p.priorNoShows },
      update: {},
    });
  }

  // 2) Results → cases via the real intake path, back-dated; then walk the pathway.
  const nowMs = Date.now();
  let created = 0;
  const stateCounts = new Map<string, number>();
  for (const r of actionable) {
    const p = patientMap.get(r.patientFhirId)!;
    const ageDays = 1 + Math.floor(rnd() * 55); // result issued 1–56 days ago
    let t = nowMs - ageDays * 86_400_000 + Math.floor(rnd() * 8) * 3_600_000;
    clock.setOffsetHours((t - Date.now()) / 3_600_000);

    const report: DiagnosticReport = {
      resourceType: 'DiagnosticReport',
      id: r.externalId,
      identifier: [{ system: 'urn:lab:report', value: r.externalId }],
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: r.loincCode }] },
      subject: { reference: `Patient/${p.fhirId}` },
      issued: new Date(t).toISOString(),
      conclusion: r.valueText,
      performer: [{ reference: 'Organization/org-lab' }],
      extension: r.flags.map((f) => ({ url: 'https://loopclose.health/fhir/StructureDefinition/flag', valueCode: f })),
    };
    const out = await intake.ingestDiagnosticReport(report);
    if (out.deduplicated || !out.caseId) continue;
    await prisma.case.update({ where: { id: out.caseId }, data: { createdAt: new Date(t), enteredStateAt: new Date(t) } });
    await prisma.screeningResult.update({ where: { id: out.resultId }, data: { issuedAt: new Date(t), receivedAt: new Date(t) } });
    created += 1;

    const programme = programmes.get(r.programmeId);
    const target = pickTarget();
    const path = programme.states.map((s) => s.id).filter((id) => !programme.terminalStates.includes(id));
    const targetIdx = path.indexOf(target);
    const stopIdx = targetIdx >= 0 ? targetIdx : path.length - 1; // exits/closed walk to the end first
    let snap: CaseSnapshot | null = null;
    let state = programme.initialState;
    let current: Owner = ownerFor(programme.states[0]!.ownerRole!);

    for (let i = 1; i <= stopIdx && i < path.length; i++) {
      const nextId = path[i]!;
      const def = programme.states.find((s) => s.id === nextId)!;
      // advance clock by a fraction of the state's SLA window (0.3–1.6 → some breaches)
      const sla = def.sla?.[snapResult(snap)?.tier ?? 'routine'] as { hours?: number; days?: number; businessDays?: number } | undefined;
      const windowH = sla?.hours ?? (sla?.days ?? sla?.businessDays ?? 2) * 24;
      t += Math.max(1, (0.3 + rnd() * 1.3) * windowH) * 3_600_000;
      if (t > nowMs) break; // history can't run into the future
      clock.setOffsetHours((t - Date.now()) / 3_600_000);

      const owner = def.ownerRole && def.ownerRole !== current.role ? ownerFor(def.ownerRole) : undefined;
      // Occasional loops that make the demo honest: referral declined, no-show
      if (nextId === 'referral_accepted' && chance(0.15)) {
        snap = await cases.execute(out.caseId, { type: 'transition', to: 'referral_sent', actor: actorFor(current), loopReason: 'referral_declined', reason: 'Wrong site / capacity', owner: ownerFor('specialist') });
        current = snap.owner ?? current;
      }
      if (nextId === 'confirmatory_done' && chance(0.12)) {
        snap = await cases.execute(out.caseId, { type: 'transition', to: 'appointment_booked', actor: actorFor(current), loopReason: 'no_show', reason: 'Patient did not attend' });
      }
      if (nextId === 'patient_acknowledged' && chance(0.6)) {
        for (let k = 0; k < 1 + Math.floor(rnd() * 2); k++) {
          snap = await cases.execute(out.caseId, { type: 'record_outreach', actor: actorFor(current), attempt: { channel: pick(['whatsapp', 'sms', 'phone', 'email']), at: new Date(t - k * 3_600_000).toISOString(), outcome: pick(['delivered', 'no_response', 'reached', 'failed']) } });
        }
      }
      snap = await cases.execute(out.caseId, { type: 'transition', to: nextId, actor: actorFor(current), ...(owner ? { owner } : {}) });
      state = nextId;
      if (owner) current = owner;
    }

    // Terminal outcomes
    if (snap && t < nowMs) {
      t += 3_600_000 * (2 + rnd() * 20);
      clock.setOffsetHours((t - Date.now()) / 3_600_000);
      if (target === 'closed' && (state === 'confirmatory_done' || state === 'treatment_or_surveillance')) {
        const evType = programme.id === 'colorectal-fit' ? 'colonoscopy_report' : programme.closure.evidenceTypes[0]!;
        snap = await cases.execute(out.caseId, { type: 'close', actor: actorFor(current), evidence: [{ type: evType, reference: `DocumentReference/${out.caseId}-report`, recordedBy: actorFor(current), recordedAt: new Date(t).toISOString() }] });
        state = 'closed';
      } else if (target === 'declined_by_patient' && programme.exits.declined_by_patient?.fromStates.includes(state)) {
        snap = await cases.execute(out.caseId, { type: 'exit', kind: 'declined_by_patient', actor: actorFor(current), justification: 'Patient declined further investigation after informed discussion (documented).' });
        state = 'declined_by_patient';
      } else if (target === 'lost_to_follow_up' && programme.exits.lost_to_follow_up?.fromStates.includes(state)) {
        for (const ch of ['whatsapp', 'sms', 'phone'] as const) {
          snap = await cases.execute(out.caseId, { type: 'record_outreach', actor: actorFor(current), attempt: { channel: ch, at: new Date(t).toISOString(), outcome: 'no_response' } });
          t += 36 * 3_600_000;
          if (t > nowMs) break;
          clock.setOffsetHours((t - Date.now()) / 3_600_000);
        }
        if (t <= nowMs) {
          snap = await cases.execute(out.caseId, { type: 'exit', kind: 'lost_to_follow_up', actor: actorFor(current), justification: 'Outreach protocol exhausted: 3 attempts, 3 channels incl. phone.' });
          state = 'lost_to_follow_up';
        }
      }
    }
    stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1);
  }

  clock.setOffsetHours(Number(process.env.DEMO_CLOCK_OFFSET_HOURS ?? 0));
  console.log(`Seeded ${created} synthetic cases from ${actionable.length} actionable results.`);
  console.table(Object.fromEntries([...stateCounts.entries()].sort()));
  console.log('Outbox rows will be projected to HAPI by the running API (outbox.drain cron); SLA timers in the past fire on next API start.');
  await app.close();
}

function snapResult(s: CaseSnapshot | null) {
  return s;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
