import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  applyCommand,
  createCase,
  resolveTier,
  type Actor,
  type CaseCommand,
  type CaseEvent,
  type CaseSnapshot,
  type Owner,
  type MachineError,
} from '@loopclose/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { ProgrammeRegistry } from '../../common/programme-registry.service';
import { ClockService } from '../../common/clock.service';
import { CaseRepository } from './case.repository';
import { SlaScheduler } from '../sla/sla.scheduler';

/**
 * Application service around the pure state machine. All writes go: load snapshot -> applyCommand
 * -> commit(expectedVersion). Domain errors become 400s with the machine error code in the body,
 * which the UI uses to explain *why* (e.g. "Closure requires evidence").
 */
export type WorklistTab = 'overdue' | 'unassigned' | 'rejected' | 'stalled' | 'at_risk' | 'all';

@Injectable()
export class CasesService {
  private readonly log = new Logger(CasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly programmes: ProgrammeRegistry,
    private readonly clock: ClockService,
    private readonly repo: CaseRepository,
    private readonly sla: SlaScheduler,
  ) {}

  /** Opens a case for an actionable result. Called by the intake adapter (E11.1). */
  async openForResult(resultId: string, initialOwner: Owner): Promise<CaseSnapshot> {
    const result = await this.prisma.screeningResult.findUniqueOrThrow({ where: { id: resultId }, include: { patient: true } });
    if (!result.actionable) throw new BadRequestException('Result is not actionable');
    const programme = this.programmes.get(result.programmeId);
    const age = Math.floor((this.clock.now().getTime() - result.patient.birthDate.getTime()) / (365.25 * 86_400_000));
    const tier = resolveTier(programme, { flags: result.flags, age });

    const created = await this.prisma.case.create({
      data: {
        programmeId: programme.id,
        resultId: result.id,
        patientId: result.patientId,
        state: programme.initialState,
        tier,
        ownerId: initialOwner.id,
        ownerRole: initialOwner.role,
        ownerOrgId: initialOwner.organizationId ?? null,
        version: 0,
      },
    });
    const out = createCase({ id: created.id, programme, tier, owner: initialOwner, now: this.clock.now() });
    if (!out.ok) throw this.toHttp(out.error);
    await this.repo.commit(0, out.value.snapshot, out.value.events);
    await this.armTimers(out.value.snapshot, out.value.events);
    this.log.log(`Opened case ${created.id} (${programme.id}, ${tier})`);
    return out.value.snapshot;
  }

  async execute(caseId: string, command: CaseCommand): Promise<CaseSnapshot> {
    const snapshot = await this.repo.loadSnapshot(caseId);
    const programme = this.programmes.get(snapshot.programmeId);
    const out = applyCommand(snapshot, command, programme, this.clock.now());
    if (!out.ok) throw this.toHttp(out.error);
    await this.repo.commit(snapshot.version, out.value.snapshot, out.value.events);
    await this.armTimers(out.value.snapshot, out.value.events);
    return out.value.snapshot;
  }

  /** Every `sla.scheduled` event arms warn+breach timers keyed by case+version (E3.2). */
  private async armTimers(snapshot: CaseSnapshot, events: CaseEvent[]) {
    for (const ev of events) {
      if (ev.type !== 'sla.scheduled') continue;
      await this.sla.scheduleForState({
        caseId: snapshot.id,
        version: snapshot.version,
        state: ev.state,
        enteredAt: new Date(ev.at),
        deadlineAt: new Date(ev.deadlineAt),
      });
    }
  }

  async get(caseId: string) {
    return this.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      include: { patient: true, result: true, owner: true, evidence: true, referrals: true, appointments: true, escalations: { where: { status: 'open' } }, proposals: { where: { status: 'pending' } } },
    });
  }

  async timeline(caseId: string) {
    return this.prisma.caseEvent.findMany({ where: { caseId }, orderBy: { sequence: 'asc' } });
  }

  /** Worklist query (E3.1). Org scoping: non-programme users only see cases they or their org own. */
  async list(filter: { state?: string; ownerId?: string; tab?: WorklistTab; programmeId?: string; tier?: string }, viewer: Actor) {
    const where = this.worklistWhere(filter, viewer);
    return this.prisma.case.findMany({ where, include: { patient: { select: { givenName: true, familyName: true, preferredLocale: true } }, owner: { select: { displayName: true, role: true } } }, orderBy: [{ slaDeadlineAt: 'asc' }], take: 200 });
  }

  /** Counts per worklist tab (for tab badges), under the same org scoping as list(). */
  async summary(filter: { programmeId?: string; tier?: string }, viewer: Actor): Promise<Record<WorklistTab, number>> {
    const tabs: WorklistTab[] = ['overdue', 'unassigned', 'rejected', 'stalled', 'at_risk', 'all'];
    const counts = await Promise.all(tabs.map((tab) => this.prisma.case.count({ where: this.worklistWhere({ ...filter, tab }, viewer) })));
    return Object.fromEntries(tabs.map((t, i) => [t, counts[i]])) as Record<WorklistTab, number>;
  }

  private worklistWhere(filter: { state?: string; ownerId?: string; tab?: WorklistTab; programmeId?: string; tier?: string }, viewer: Actor): Prisma.CaseWhereInput {
    const now = this.clock.now();
    const programmes = this.programmes.list();
    const terminal = new Set(programmes.flatMap((p) => p.terminalStates));
    const where: Prisma.CaseWhereInput = { state: { notIn: [...terminal] } };
    if (filter.state) where.state = filter.state;
    if (filter.ownerId) where.ownerId = filter.ownerId;
    if (filter.programmeId) where.programmeId = filter.programmeId;
    if (filter.tier) where.tier = filter.tier as Prisma.CaseWhereInput['tier'];
    switch (filter.tab) {
      case 'overdue':
        where.slaDeadlineAt = { lt: now };
        break;
      case 'unassigned':
        where.ownerId = null;
        break;
      case 'rejected':
        where.referralDeclineCount = { gt: 0 };
        where.state = 'referral_sent';
        break;
      case 'stalled':
        where.stalled = true;
        break;
      case 'at_risk':
        where.riskTier = 'red';
        break;
      default:
        break;
    }
    const isProgrammeWide = viewer.role === 'coordinator' || viewer.role === 'coordinator_lead' || viewer.role === 'programme_manager' || viewer.role === 'admin';
    if (!isProgrammeWide && viewer.organizationId) where.ownerOrgId = viewer.organizationId;
    return where;
  }

  private toHttp(err: MachineError) {
    return new BadRequestException({ code: err.code, message: err.message, details: err.details });
  }
}
