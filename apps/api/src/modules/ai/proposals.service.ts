import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Actor } from '@loopclose/shared';
import { PrismaService } from '../../common/prisma.service';
import { ProgrammeRegistry } from '../../common/programme-registry.service';
import { CasesService } from '../cases/cases.service';

/**
 * The only way an AI proposal takes effect is a human decision here (ADR-006). For an
 * `acknowledgement` (navigator teach-back passed), acceptance makes the HUMAN the actor of the
 * transition to `patient_acknowledged` and assigns the next owner in the same command, so the
 * ownership invariant holds and AI never assigns anyone.
 */
@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programmes: ProgrammeRegistry,
    private readonly cases: CasesService,
  ) {}

  list(filter: { status?: string; caseId?: string; kind?: string }) {
    return this.prisma.aIProposal.findMany({
      where: {
        ...(filter.status ? { status: filter.status as never } : {}),
        ...(filter.caseId ? { caseId: filter.caseId } : {}),
        ...(filter.kind ? { kind: filter.kind as never } : { kind: { not: 'risk_assessment' as never } }),
      },
      include: { case: { select: { id: true, state: true, programmeId: true, tier: true, patient: { select: { givenName: true, familyName: true, preferredLocale: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async decide(id: string, decision: 'accepted' | 'rejected', actor: Actor, opts: { ownerId?: string | undefined; note?: string | undefined } = {}) {
    const p = await this.prisma.aIProposal.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Proposal not found');
    if (p.status !== 'pending') throw new BadRequestException(`Proposal already ${p.status}`);

    if (decision === 'accepted' && p.kind === 'acknowledgement') {
      const c = await this.prisma.case.findUniqueOrThrow({ where: { id: p.caseId } });
      const programme = this.programmes.get(c.programmeId);
      const target = programme.states.find((s) => s.id === 'patient_acknowledged');
      if (!target?.ownerRole) throw new BadRequestException('Programme has no patient_acknowledged state');
      const owner = opts.ownerId ? await this.prisma.user.findUniqueOrThrow({ where: { id: opts.ownerId } }) : await this.leastLoaded(target.ownerRole);
      if (!owner) throw new BadRequestException(`No user with role ${target.ownerRole} to take ownership`);
      await this.cases.execute(c.id, {
        type: 'transition',
        to: 'patient_acknowledged',
        actor,
        owner: { id: owner.id, role: owner.role, organizationId: owner.organizationId },
        reason: `Teach-back passed (navigator proposal ${p.id.slice(0, 8)}), confirmed by coordinator${opts.note ? `: ${opts.note}` : ''}`,
      });
    }
    return this.prisma.aIProposal.update({ where: { id }, data: { status: decision, decidedById: actor.id, decidedAt: new Date() } });
  }

  /** Default owner: the user with that role holding the fewest open cases. */
  private async leastLoaded(role: string) {
    const users = await this.prisma.user.findMany({ where: { role }, include: { _count: { select: { ownedCases: { where: { closedAt: null } } } } } });
    return users.sort((a, b) => a._count.ownedCases - b._count.ownedCases)[0] ?? null;
  }
}
