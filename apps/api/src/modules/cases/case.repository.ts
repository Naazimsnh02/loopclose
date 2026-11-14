import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { warnAtFor, type CaseEvent, type CaseSnapshot } from '@loopclose/shared';
import { PrismaService } from '../../common/prisma.service';
import { JobsService, Queues } from '../../common/jobs.service';

/**
 * Persists CaseSnapshot + events atomically with optimistic concurrency (E2.2).
 * The Case row is a projection; CaseEvent is the source of truth.
 */
@Injectable()
export class CaseRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  async loadSnapshot(id: string): Promise<CaseSnapshot> {
    const c = await this.prisma.case.findUnique({
      where: { id },
      include: { evidence: true, outreach: true, owner: true },
    });
    if (!c) throw new NotFoundException(`Case ${id} not found`);
    return {
      id: c.id,
      programmeId: c.programmeId,
      state: c.state,
      tier: c.tier,
      owner: c.ownerId && c.ownerRole ? { id: c.ownerId, role: c.ownerRole, ...(c.ownerOrgId ? { organizationId: c.ownerOrgId } : {}) } : null,
      version: c.version,
      createdAt: c.createdAt.toISOString(),
      enteredStateAt: c.enteredStateAt.toISOString(),
      slaDeadlineAt: c.slaDeadlineAt?.toISOString() ?? null,
      evidence: c.evidence.map((e) => ({
        type: e.type,
        reference: e.reference,
        recordedBy: { kind: 'human', id: e.recordedBy },
        recordedAt: e.recordedAt.toISOString(),
      })),
      outreachAttempts: c.outreach.map((o) => ({
        channel: o.channel,
        at: o.at.toISOString(),
        outcome: o.outcome as CaseSnapshot['outreachAttempts'][number]['outcome'],
      })),
      noShowCount: c.noShowCount,
      referralDeclineCount: c.referralDeclineCount,
    };
  }

  /**
   * Writes the new snapshot and appends events in one transaction. Fails with 409 if another
   * writer advanced the version first (expectedVersion = snapshot.version before the command).
   */
  async commit(expectedVersion: number, next: CaseSnapshot, events: CaseEvent[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.case.updateMany({
        where: { id: next.id, version: expectedVersion },
        data: {
          state: next.state,
          tier: next.tier,
          ownerId: next.owner?.id ?? null,
          ownerRole: next.owner?.role ?? null,
          ownerOrgId: next.owner?.organizationId ?? null,
          version: next.version,
          enteredStateAt: new Date(next.enteredStateAt),
          slaDeadlineAt: next.slaDeadlineAt ? new Date(next.slaDeadlineAt) : null,
          slaWarnAt: next.slaDeadlineAt ? warnAtFor(new Date(next.enteredStateAt), new Date(next.slaDeadlineAt)) : null,
          noShowCount: next.noShowCount,
          referralDeclineCount: next.referralDeclineCount,
          closedAt: next.state === 'closed' ? new Date(next.enteredStateAt) : undefined,
        },
      });
      if (updated.count !== 1) throw new ConflictException(`Case ${next.id} was modified concurrently`);

      const last = await tx.caseEvent.findFirst({ where: { caseId: next.id }, orderBy: { sequence: 'desc' }, select: { sequence: true } });
      let seq = last?.sequence ?? 0;
      for (const ev of events) {
        seq += 1;
        const actor = 'actor' in ev ? ev.actor : { kind: 'system' as const, id: 'engine', role: undefined };
        await tx.caseEvent.create({
          data: {
            caseId: next.id,
            sequence: seq,
            type: ev.type,
            actorKind: actor.kind,
            actorId: actor.id,
            actorRole: actor.role ?? null,
            payload: ev as unknown as Prisma.InputJsonValue,
            occurredAt: new Date(ev.at),
          },
        });
        if (ev.type === 'case.evidence_attached') {
          await tx.evidence.create({
            data: { caseId: next.id, type: ev.evidence.type, reference: ev.evidence.reference, recordedBy: ev.evidence.recordedBy.id, recordedAt: new Date(ev.evidence.recordedAt) },
          });
        }
        if (ev.type === 'case.outreach_recorded') {
          await tx.outreachAttempt.create({ data: { caseId: next.id, channel: ev.attempt.channel, outcome: ev.attempt.outcome, at: new Date(ev.attempt.at) } });
        }
        // Outbox: FHIR projection + notifications are drained asynchronously (E2.4).
        await tx.outbox.create({ data: { kind: 'fhir.project_case_event', payload: { caseId: next.id, sequence: seq, type: ev.type } } });
      }
    });
    await this.jobs.nudge(Queues.outboxDrain);
    await this.jobs.recomputeRisk(next.id);
  }
}
