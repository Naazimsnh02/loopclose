import { BadRequestException, Body, Controller, ForbiddenException, Get, Module, NotFoundException, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import type { DiagnosticReport } from 'fhir/r4';
import { Loinc } from '@loopclose/fhir';
import type { Actor, Owner } from '@loopclose/shared';
import { CurrentUser, Roles, type AuthenticatedUser } from '../../common/actor';
import { ClockService } from '../../common/clock.service';
import { demoControlsEnabled } from '../../common/demo-mode';
import { PrismaService } from '../../common/prisma.service';
import { ProgrammeRegistry } from '../../common/programme-registry.service';
import { CasesModule } from '../cases/cases.module';
import { CasesService } from '../cases/cases.service';
import { EscalationsModule } from '../escalations/escalations.module';
import { EscalationsService } from '../escalations/escalations.service';
import { IntegrationModule } from '../integration/integration.module';
import { IntakeService } from '../integration/intake.service';
import { MessagingModule } from '../messaging/messaging.module';
import { ChannelRouter } from '../messaging/channel-router.service';
import { AiModule } from '../ai/ai.module';
import { AiFeatureFlags } from '../ai/feature-flags.service';

class ClockDto {
  @IsNumber() @Min(-24 * 30) @Max(24 * 60) offsetHours!: number;
}

class ResultDto {
  @IsIn(['colorectal-fit', 'breast-birads']) programmeId!: 'colorectal-fit' | 'breast-birads';
  @IsIn(['ar', 'en', 'ur', 'hi']) locale!: 'ar' | 'en' | 'ur' | 'hi';
  @IsIn(['routine', 'priority', 'urgent']) tier!: 'routine' | 'priority' | 'urgent';
}

class CaseDto {
  @IsOptional() @IsString() caseId?: string;
}

class ChannelDto {
  @IsString() patientId!: string;
  @IsBoolean() fail!: boolean;
}

/** Synthetic names per language so a pushed result looks like a real patient in the worklist. */
const NAMES: Record<string, { f: [string, string][]; m: [string, string][] }> = {
  ar: { f: [['Fatima', 'Al Mansoori'], ['Mariam', 'Al Dhaheri'], ['Aisha', 'Al Ketbi'], ['Shamma', 'Al Nuaimi']], m: [['Ahmed', 'Al Hammadi'], ['Saeed', 'Al Mazrouei'], ['Khalfan', 'Al Shamsi'], ['Rashid', 'Al Kaabi']] },
  ur: { f: [['Ayesha', 'Khan'], ['Nadia', 'Qureshi'], ['Sana', 'Malik']], m: [['Imran', 'Butt'], ['Tariq', 'Mehmood'], ['Asif', 'Chaudhry']] },
  hi: { f: [['Lakshmi', 'Nair'], ['Sunita', 'Sharma'], ['Priya', 'Menon']], m: [['Rajesh', 'Kumar'], ['Suresh', 'Pillai'], ['Anil', 'Verma']] },
  en: { f: [['Sarah', 'Thompson'], ['Grace', 'Okafor'], ['Maria', 'Santos']], m: [['Daniel', 'Brooks'], ['Joseph', 'Reyes'], ['Michael', 'Owens']] },
};
const NATIONALITY: Record<string, string> = { ar: 'AE', ur: 'PK', hi: 'IN', en: 'PH' };
const DEMO_PREFIX = 'demo-';

/**
 * E7.8 / E10.5 / E14.3 — Demo-only controls so a live audience can watch the loop react:
 * push a lab result, fast-forward the clock (with an immediate SLA sweep), simulate a no-show,
 * a declined referral or a failing channel, and reset the session. Every action goes through the
 * real services (intake, case engine, escalations), never around them.
 * Disabled unless DEMO_MODE=true (and, in production builds, DEMO_SANDBOX=true). See common/demo-mode.ts.
 */
@ApiTags('demo')
@ApiBearerAuth()
@Controller('demo')
@Roles('admin', 'coordinator', 'coordinator_lead', 'programme_manager')
class DemoController {
  constructor(
    private readonly clock: ClockService,
    private readonly prisma: PrismaService,
    private readonly programmes: ProgrammeRegistry,
    private readonly cases: CasesService,
    private readonly intake: IntakeService,
    private readonly escalations: EscalationsService,
    private readonly channels: ChannelRouter,
    private readonly flags: AiFeatureFlags,
  ) {}

  private guard() {
    if (!demoControlsEnabled()) throw new ForbiddenException('Demo controls disabled');
  }

  private actor(u: AuthenticatedUser): Actor {
    return { kind: 'human', id: u.id, role: u.role, organizationId: u.organizationId };
  }

  private async ownerFor(role: string): Promise<Owner> {
    const u = await this.prisma.user.findFirst({ where: { role }, orderBy: { id: 'asc' } });
    if (!u) throw new BadRequestException(`No user with role ${role}`);
    return { id: u.id, role: u.role, organizationId: u.organizationId };
  }

  private terminal() {
    return this.programmes.list().flatMap((p) => p.terminalStates);
  }

  @Get('state')
  async state() {
    this.guard();
    const terminal = this.terminal();
    const failing = this.channels.failing();
    const [demoCases, noShowCandidates, referralCandidates, failingPatients] = await Promise.all([
      this.prisma.case.count({ where: { patient: { fhirId: { startsWith: DEMO_PREFIX } } } }),
      this.prisma.case.count({ where: { state: 'appointment_booked' } }),
      this.prisma.case.count({ where: { state: 'referral_sent' } }),
      this.prisma.patient.findMany({ where: { id: { in: failing } }, select: { id: true, givenName: true, familyName: true } }),
    ]);
    const now = this.clock.now();
    const overdue = await this.prisma.case.count({ where: { state: { notIn: terminal }, slaDeadlineAt: { lte: now } } });
    return { offsetHours: this.clock.offsetHours(), now: now.toISOString(), demoCases, noShowCandidates, referralCandidates, overdue, failingPatients };
  }

  @Get('clock')
  clockGet() {
    this.guard();
    return { offsetHours: this.clock.offsetHours(), now: this.clock.now().toISOString() };
  }

  /** Shift "now", then sweep: every open case whose deadline has passed gets its breach escalation immediately. */
  @Post('clock')
  async clockSet(@Body() dto: ClockDto) {
    this.guard();
    this.clock.setOffsetHours(dto.offsetHours);
    const now = this.clock.now();
    const overdue = await this.prisma.case.findMany({
      where: { state: { notIn: this.terminal() }, slaDeadlineAt: { lte: now }, escalations: { none: { ruleId: 'sla-breach', status: { in: ['open', 'acknowledged'] } } } },
      select: { id: true, state: true },
    });
    for (const c of overdue) await this.escalations.handle({ type: 'sla.breach', caseId: c.id, state: c.state });
    return { offsetHours: this.clock.offsetHours(), now: now.toISOString(), newBreaches: overdue.length };
  }

  /** Create a synthetic patient and push their result through the real FHIR intake path. */
  @Post('result')
  async pushResult(@Body() dto: ResultDto) {
    this.guard();
    const sex = dto.programmeId === 'breast-birads' ? 'female' : Math.random() < 0.5 ? 'female' : 'male';
    const pool = NAMES[dto.locale]![sex === 'female' ? 'f' : 'm'];
    const [given, family] = pool[Math.floor(Math.random() * pool.length)]!;
    const stamp = Date.now().toString(36);
    const now = this.clock.now();
    const age = 50 + Math.floor(Math.random() * 20);
    const patient = await this.prisma.patient.create({
      data: {
        fhirId: `${DEMO_PREFIX}${stamp}`,
        givenName: given,
        familyName: family,
        birthDate: new Date(Date.UTC(now.getUTCFullYear() - age, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 27))),
        sex,
        nationality: NATIONALITY[dto.locale],
        preferredLocale: dto.locale,
        phone: `+9715${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
        distanceKm: Math.round(5 + Math.random() * 40),
        consents: { create: [{ scope: 'messaging:web_chat', granted: true, source: 'demo_enrolment' }, { scope: 'messaging:whatsapp', granted: true, source: 'demo_enrolment' }, { scope: 'ai_assisted_communication', granted: true, source: 'demo_enrolment' }] },
      },
    });

    const fit = dto.programmeId === 'colorectal-fit';
    const flags = fit ? { routine: [], priority: ['anaemia'], urgent: ['alarm_symptoms'] }[dto.tier] : [];
    const birads = { routine: '4A', priority: '4C', urgent: '5' }[dto.tier];
    const report: DiagnosticReport = {
      resourceType: 'DiagnosticReport',
      id: `${DEMO_PREFIX}report-${stamp}`,
      identifier: [{ system: 'urn:lab:report', value: `${DEMO_PREFIX}report-${stamp}` }],
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: fit ? Loinc.fitResult : Loinc.mammogramBirads }] },
      subject: { reference: `Patient/${patient.fhirId}` },
      issued: now.toISOString(),
      conclusion: fit ? 'FIT positive' : `BI-RADS ${birads}`,
      performer: [{ reference: fit ? 'Organization/org-lab' : 'Organization/org-breast-1' }],
      extension: flags.map((f) => ({ url: 'https://loopclose.health/fhir/StructureDefinition/flag', valueCode: f })),
    };
    const out = await this.intake.ingestDiagnosticReport(report);
    return { ...out, patient: { id: patient.id, name: `${given} ${family}`, locale: dto.locale } };
  }

  /** Patient did not attend: the case loops back to "appointment booked" and the team is told. */
  @Post('no-show')
  async noShow(@Body() dto: CaseDto, @CurrentUser() user: AuthenticatedUser) {
    this.guard();
    const c = dto.caseId
      ? await this.prisma.case.findUnique({ where: { id: dto.caseId } })
      : await this.prisma.case.findFirst({ where: { state: 'appointment_booked' }, orderBy: [{ tier: 'desc' }, { enteredStateAt: 'asc' }] });
    if (!c) throw new NotFoundException('No case with a booked appointment');
    if (c.state !== 'appointment_booked') throw new BadRequestException('Case has no booked appointment');
    await this.prisma.appointment.updateMany({ where: { caseId: c.id, status: 'booked' }, data: { status: 'no_show' } })
    const snap = await this.cases.execute(c.id, { type: 'transition', to: 'appointment_booked', actor: this.actor(user), loopReason: 'no_show', reason: 'Patient did not attend (demo)' });
    await this.escalations.handle({ type: 'appointment.no_show', caseId: c.id, state: c.state, meta: { count: snap.noShowCount } });
    return { caseId: c.id, noShowCount: snap.noShowCount };
  }

  /** The specialist declines the referral: it bounces back to the coordinator to redirect. */
  @Post('referral-decline')
  async referralDecline(@Body() dto: CaseDto) {
    this.guard();
    const c = dto.caseId
      ? await this.prisma.case.findUnique({ where: { id: dto.caseId } })
      : await this.prisma.case.findFirst({ where: { state: 'referral_sent', referrals: { none: { status: 'declined' } } }, orderBy: [{ tier: 'desc' }, { enteredStateAt: 'asc' }] });
    if (!c) throw new NotFoundException('No case with an open referral');
    if (c.state !== 'referral_sent') throw new BadRequestException('Case has no open referral');
    const reason = 'No capacity within the SLA window; suggest an alternative site';
    let referral = await this.prisma.referral.findFirst({ where: { caseId: c.id, status: 'offered' }, orderBy: { offeredAt: 'desc' } });
    referral ??= await this.prisma.referral.create({
      data: { caseId: c.id, initiatorOrgId: 'org-programme', recipientOrgId: c.ownerOrgId ?? 'org-gi-1', procedureCode: c.programmeId === 'breast-birads' ? 'breast-biopsy' : 'colonoscopy', reason: 'Positive screening result' },
    });
    await this.prisma.referral.update({ where: { id: referral.id }, data: { status: 'declined', declineReason: reason, respondedAt: this.clock.now() } });
    await this.escalations.handle({ type: 'referral.declined', caseId: c.id, state: c.state, meta: { reason } });
    return { caseId: c.id, referralId: referral.id };
  }

  /** Make every simulated channel fail for one patient, to show fallback and escalation. */
  @Post('channel-failure')
  channelFailure(@Body() dto: ChannelDto) {
    this.guard();
    this.channels.injectFailure(dto.patientId, dto.fail);
    return { failing: this.channels.failing() };
  }

  /**
   * Reset the demo session: remove demo-created patients and everything hanging off them, clear
   * navigator conversations and the hand-offs they raised, restore the clock, channels and AI switches.
   * The seeded population is untouched (full reseed: `make reset && make demo`).
   */
  @Post('reset')
  async reset(@CurrentUser() user: AuthenticatedUser) {
    this.guard();
    const demoCases = await this.prisma.case.findMany({ where: { patient: { fhirId: { startsWith: DEMO_PREFIX } } }, select: { id: true } });
    const ids = demoCases.map((c) => c.id);
    const byCase = { caseId: { in: ids } };
    const [removed] = await this.prisma.$transaction([
      this.prisma.case.count({ where: { id: { in: ids } } }),
      this.prisma.aIProposal.deleteMany({ where: byCase }),
      this.prisma.escalation.deleteMany({ where: byCase }),
      this.prisma.message.deleteMany({ where: { OR: [byCase, { patient: { fhirId: { startsWith: DEMO_PREFIX } } }] } }),
      this.prisma.appointment.deleteMany({ where: byCase }),
      this.prisma.referral.deleteMany({ where: byCase }),
      this.prisma.consult.deleteMany({ where: byCase }),
      this.prisma.outreachAttempt.deleteMany({ where: byCase }),
      this.prisma.evidence.deleteMany({ where: byCase }),
      this.prisma.caseEvent.deleteMany({ where: byCase }),
      this.prisma.case.deleteMany({ where: { id: { in: ids } } }),
      this.prisma.screeningResult.deleteMany({ where: { patient: { fhirId: { startsWith: DEMO_PREFIX } } } }),
      this.prisma.consentRecord.deleteMany({ where: { patient: { fhirId: { startsWith: DEMO_PREFIX } } } }),
      this.prisma.patient.deleteMany({ where: { fhirId: { startsWith: DEMO_PREFIX } } }),
      // Navigator conversations on seeded cases, and what they raised.
      this.prisma.message.deleteMany({ where: { channel: 'web_chat' } }),
      this.prisma.escalation.deleteMany({ where: { ruleId: { startsWith: 'patient-' } } }),
      this.prisma.aIProposal.deleteMany({ where: { kind: 'acknowledgement', status: 'pending' } }),
    ]);
    this.clock.setOffsetHours(0);
    this.channels.clearFailures();
    for (const name of ['navigator', 'risk', 'summariser'] as const) {
      if (!(await this.flags.isEnabled(name))) await this.flags.set(name, true, user.id, 'Demo reset');
    }
    return { removedDemoCases: removed, offsetHours: 0 };
  }
}

@Module({ imports: [CasesModule, EscalationsModule, IntegrationModule, MessagingModule, AiModule], controllers: [DemoController] })
export class DemoModule {}
