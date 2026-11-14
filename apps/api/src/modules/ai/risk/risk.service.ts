import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaService } from '../../../common/prisma.service';
import { ClockService } from '../../../common/clock.service';
import { AiFeatureFlags } from '../feature-flags.service';

/**
 * E6.2–E6.5 — Drop-off risk. Model is a logistic regression trained in analytics/risk_model and exported
 * as JSON (coefficients + feature means/scales + thresholds). Scored here, in TypeScript, so the API has
 * no Python dependency and every score is explainable (top contributions = reasons).
 * Rules fallback applies when no model file exists (first 30 days of a pilot).
 */
export interface RiskModelJson {
  version: string;
  trainedOn: string;
  features: string[];
  intercept: number;
  coefficients: Record<string, number>;
  scaler: Record<string, { mean: number; scale: number }>;
  thresholds: { amber: number; red: number };
  limitation: string;
}

export interface RiskResult {
  score: number;
  tier: 'green' | 'amber' | 'red';
  reasons: Array<{ feature: string; contribution: number; label: string }>;
  mode: 'model' | 'rules';
  modelVersion: string;
}

const FEATURE_LABELS: Record<string, string> = {
  hours_since_notification_no_ack: 'No acknowledgement since notification',
  channel_failures: 'Message delivery failures',
  prior_no_shows: 'Previous missed appointments',
  transport_barrier: 'Transport / distance barrier',
  language_mismatch: 'Preferred language not matched by clinic',
  age_band_70plus: 'Age 70+',
  referral_pending_days: 'Referral awaiting acceptance',
  weekend_entry: 'Entered stage on a weekend',
};

@Injectable()
export class RiskService implements OnModuleInit {
  private readonly log = new Logger(RiskService.name);
  private model: RiskModelJson | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly flags: AiFeatureFlags,
  ) {}

  onModuleInit() {
    const path = process.env.RISK_MODEL_PATH ?? resolve(process.cwd(), '../../analytics/output/risk_model.json');
    if (existsSync(path)) {
      this.model = JSON.parse(readFileSync(path, 'utf8')) as RiskModelJson;
      this.log.log(`Loaded risk model ${this.model.version} (${this.model.features.length} features)`);
    } else {
      this.log.warn(`No risk model at ${path}; using rules fallback`);
    }
  }

  /** Human-readable description of what is scoring risk right now. */
  engine(): string {
    return this.model ? `Logistic model ${this.model.version} (synthetic-trained)` : 'Rules fallback';
  }

  async features(caseId: string): Promise<Record<string, number>> {
    const c = await this.prisma.case.findUniqueOrThrow({ where: { id: caseId }, include: { patient: true, messages: true, referrals: true } });
    const now = this.clock.now();
    const hours = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / 3_600_000);
    const notified = c.messages.find((m) => m.direction === 'outbound' && m.delivery !== 'failed')?.sentAt ?? null;
    const acked = c.state !== 'result_issued' && c.state !== 'patient_notified';
    const pendingReferral = c.referrals.find((r) => r.status === 'offered');
    return {
      hours_since_notification_no_ack: notified && !acked ? hours(notified, now) : 0,
      channel_failures: c.messages.filter((m) => m.delivery === 'failed').length,
      prior_no_shows: c.patient.priorNoShows + c.noShowCount,
      transport_barrier: c.patient.transportBarrier ? 1 : 0,
      language_mismatch: c.patient.preferredLocale === 'en' || c.patient.preferredLocale === 'ar' ? 0 : 1,
      age_band_70plus: now.getFullYear() - c.patient.birthDate.getFullYear() >= 70 ? 1 : 0,
      referral_pending_days: pendingReferral ? hours(pendingReferral.offeredAt, now) / 24 : 0,
      weekend_entry: [5, 6].includes(c.enteredStateAt.getUTCDay()) ? 1 : 0,
    };
  }

  /**
   * Scores one case and stores the tier on it. A risk_assessment proposal is only written when the
   * tier changes (or on an explicit request), so periodic recomputes don't flood the review queue.
   */
  async score(caseId: string, opts: { force?: boolean } = {}): Promise<Omit<RiskResult, 'reasons'> & { reasons: Array<RiskResult['reasons'][number] & { suggestedAction: string }>; previousTier: string | null }> {
    await this.flags.assertEnabled('risk');
    const before = await this.prisma.case.findUniqueOrThrow({ where: { id: caseId }, select: { riskTier: true } });
    const x = await this.features(caseId);
    const result = this.model ? scoreWithModel(this.model, x) : scoreWithRules(x);
    const reasons = result.reasons.map((r) => ({ ...r, suggestedAction: SUGGESTED_ACTION[r.feature] ?? 'review_case' }));
    await this.prisma.case.update({ where: { id: caseId }, data: { riskScore: result.score, riskTier: result.tier, riskReasons: reasons } });
    if (opts.force || before.riskTier !== result.tier) {
      await this.prisma.aIProposal.create({
        data: { caseId, kind: 'risk_assessment', feature: 'risk', model: result.modelVersion, payload: { ...result, reasons, previousTier: before.riskTier } as unknown as Prisma.InputJsonValue, sourceRefs: { features: x } as Prisma.InputJsonValue },
      });
    }
    return { ...result, reasons, previousTier: before.riskTier };
  }
}

/** Suggested human action per top reason (E6.4). Advisory only; shown to the coordinator. */
export const SUGGESTED_ACTION: Record<string, string> = {
  hours_since_notification_no_ack: 'phone_call',
  channel_failures: 'switch_channel',
  prior_no_shows: 'confirm_appointment_by_phone',
  transport_barrier: 'offer_transport_or_nearer_site',
  language_mismatch: 'use_interpreter',
  age_band_70plus: 'involve_family_contact',
  referral_pending_days: 'chase_referral',
  weekend_entry: 'review_case',
};

export function scoreWithModel(m: RiskModelJson, x: Record<string, number>): RiskResult {
  let z = m.intercept;
  const contributions: Array<{ feature: string; contribution: number }> = [];
  for (const f of m.features) {
    const s = m.scaler[f] ?? { mean: 0, scale: 1 };
    const v = ((x[f] ?? 0) - s.mean) / (s.scale || 1);
    const c = (m.coefficients[f] ?? 0) * v;
    z += c;
    contributions.push({ feature: f, contribution: c });
  }
  const p = 1 / (1 + Math.exp(-z));
  const tier = p >= m.thresholds.red ? 'red' : p >= m.thresholds.amber ? 'amber' : 'green';
  const reasons = contributions.filter((c) => c.contribution > 0).sort((a, b) => b.contribution - a.contribution).slice(0, 3).map((c) => ({ ...c, label: FEATURE_LABELS[c.feature] ?? c.feature }));
  return { score: p, tier, reasons, mode: 'model', modelVersion: m.version };
}

export function scoreWithRules(x: Record<string, number>): RiskResult {
  const reasons: RiskResult['reasons'] = [];
  let points = 0;
  const add = (feature: string, pts: number) => {
    points += pts;
    reasons.push({ feature, contribution: pts, label: FEATURE_LABELS[feature] ?? feature });
  };
  if ((x.hours_since_notification_no_ack ?? 0) > 48) add('hours_since_notification_no_ack', 2);
  if ((x.channel_failures ?? 0) >= 2) add('channel_failures', 2);
  if ((x.prior_no_shows ?? 0) >= 1) add('prior_no_shows', 2);
  if (x.transport_barrier) add('transport_barrier', 1);
  if (x.language_mismatch) add('language_mismatch', 1);
  if ((x.referral_pending_days ?? 0) > 3) add('referral_pending_days', 1);
  const tier = points >= 4 ? 'red' : points >= 2 ? 'amber' : 'green';
  return { score: Math.min(1, points / 8), tier, reasons: reasons.sort((a, b) => b.contribution - a.contribution).slice(0, 3), mode: 'rules', modelVersion: 'rules-0.1.0' };
}
