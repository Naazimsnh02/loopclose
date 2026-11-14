import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { PrismaService } from '../../common/prisma.service';
import { ProgrammeRegistry } from '../../common/programme-registry.service';

export interface EscalationTrigger {
  type: string; // sla.warn | sla.breach | referral.declined | owner.offer_timeout | appointment.no_show | message.non_response | message.distress_detected | risk.tier_changed | case.created
  caseId: string;
  state?: string;
  meta?: Record<string, unknown>;
}

interface Rule {
  id: string;
  on: string;
  when?: Record<string, unknown>;
  action: 'flag_amber' | 'create_escalation';
  target?: string;
  priority?: string;
  suggestedAction?: string;
  ackWithinHours?: number;
}

@Injectable()
export class EscalationsService implements OnModuleInit {
  private readonly log = new Logger(EscalationsService.name);
  private rules: Rule[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly programmes: ProgrammeRegistry,
  ) {}

  onModuleInit() {
    const file = process.env.ESCALATION_RULES ?? resolve(process.cwd(), '../../config/escalation-rules.yaml');
    this.rules = (parseYaml(readFileSync(file, 'utf8')) as { rules: Rule[] }).rules;
    this.log.log(`Loaded ${this.rules.length} escalation rules`);
  }

  async handle(trigger: EscalationTrigger) {
    const c = await this.prisma.case.findUniqueOrThrow({ where: { id: trigger.caseId } });
    const programme = this.programmes.get(c.programmeId);
    const stateDef = programme.states.find((s) => s.id === c.state);
    for (const rule of this.rules.filter((r) => r.on === trigger.type)) {
      if (rule.when && !matches(rule.when, { tier: c.tier, ...trigger.meta })) continue;
      if (rule.action === 'flag_amber') continue; // UI derives amber from slaStatus(); nothing to persist.
      // Patient- and risk-driven rules collapse into one open escalation per case.
      if (/^(patient-|risk-)/.test(rule.id)) {
        const open = await this.prisma.escalation.findFirst({ where: { caseId: c.id, ruleId: rule.id, status: { in: ['open', 'acknowledged'] } } });
        if (open) continue;
      }
      const targetRole = rule.target === 'state.escalateTo' ? (stateDef?.escalateTo ?? 'coordinator') : (rule.target ?? 'coordinator');
      await this.prisma.escalation.create({
        data: {
          caseId: c.id,
          ruleId: rule.id,
          targetRole,
          targetOrgId: c.ownerOrgId,
          priority: rule.priority ?? (c.tier === 'urgent' ? 'urgent' : 'normal'),
          reason: describe(trigger, c.state),
          suggestedAction:
            rule.suggestedAction === 'from_risk_reasons' ? String(trigger.meta?.suggestedAction ?? 'review_case') : (rule.suggestedAction ?? null),
        },
      });
      // TODO E11.4: notify target role (in-app + email stub). TODO E6: `also: recompute_risk`.
    }
  }

  list(filter: { status?: string; targetRole?: string }) {
    return this.prisma.escalation.findMany({
      where: { ...(filter.status ? { status: filter.status as never } : {}), ...(filter.targetRole ? { targetRole: filter.targetRole } : {}) },
      include: { case: { include: { patient: { select: { givenName: true, familyName: true } } } } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  resolve(id: string, resolvedById: string, resolution: string) {
    return this.prisma.escalation.update({ where: { id }, data: { status: 'resolved', resolvedAt: new Date(), resolvedById, resolution } });
  }
}

function describe(t: EscalationTrigger, state: string): string {
  const m = t.meta ?? {};
  if (Array.isArray(m.reasons)) return `Drop-off risk red: ${(m.reasons as string[]).join('; ')}`;
  if (typeof m.reason === 'string') return m.reason;
  const label: Record<string, string> = {
    'message.emergency_detected': 'Possible emergency in patient message',
    'message.distress_detected': 'Patient expressed distress',
    'message.human_requested': 'Patient asked to speak to a person',
    'message.teach_back_failed': 'Teach-back not passed after re-explanation',
    'message.question_unanswered': 'Patient question needs a human reply',
  };
  if (label[t.type]) {
    const detail = Array.isArray(m.matched) && m.matched.length ? ` (matched: ${(m.matched as string[]).join(', ')})` : typeof m.text === 'string' ? `: "${m.text}"` : '';
    return `${label[t.type]}${detail}`;
  }
  const step = humanState(state);
  const generic: Record<string, string> = {
    'sla.breach': `Deadline passed at "${step}"`,
    'sla.warn': `Deadline approaching at "${step}"`,
    'appointment.no_show': `Patient did not attend${typeof m.count === 'number' && m.count > 1 ? ` (${m.count} missed)` : ''}`,
    'referral.declined': 'Referral declined by the receiving clinic',
    'owner.offer_timeout': `No one accepted ownership at "${step}"`,
    'case.created': 'Urgent result: needs a clinician today',
    'message.delivery_failed': 'Patient could not be reached on any channel',
    'message.non_response': 'Patient has not replied after several attempts',
  };
  return generic[t.type] ?? `${t.type} in ${step}`;
}

const STATE_LABEL: Record<string, string> = { patient_acknowledged: 'Acknowledged', treatment_or_surveillance: 'Treatment / surveillance' };
function humanState(s: string): string {
  if (STATE_LABEL[s]) return STATE_LABEL[s]!;
  const t = s.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function matches(when: Record<string, unknown>, ctx: Record<string, unknown>): boolean {
  return Object.entries(when).every(([k, v]) => ctx[k] === v);
}
