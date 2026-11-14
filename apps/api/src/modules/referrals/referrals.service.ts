import { BadRequestException, Injectable } from '@nestjs/common';
import type { Actor, Owner } from '@loopclose/shared';
import { PrismaService } from '../../common/prisma.service';
import { ClockService } from '../../common/clock.service';
import { CasesService } from '../cases/cases.service';
import { EscalationsService } from '../escalations/escalations.service';

/**
 * Referral = ServiceRequest (initiator-owned) + Task (recipient-owned). Offer/accept/decline/redirect
 * drive the case machine: offer → `referral_sent`; accept → `referral_accepted`; decline → escalation +
 * (coordinator) redirect = self-loop on `referral_sent` with loopReason 'referral_declined'.
 */
@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly cases: CasesService,
    private readonly escalations: EscalationsService,
  ) {}

  async offer(input: { caseId: string; recipientOrgId: string; recipientOwner: Owner; procedureCode: string; reason: string }, actor: Actor) {
    const c = await this.prisma.case.findUniqueOrThrow({ where: { id: input.caseId } });
    if (!c.ownerOrgId) throw new BadRequestException('Case has no owning organisation');
    const referral = await this.prisma.referral.create({
      data: {
        caseId: c.id,
        initiatorOrgId: c.ownerOrgId,
        recipientOrgId: input.recipientOrgId,
        procedureCode: input.procedureCode,
        reason: input.reason,
        continuityPacket: await this.buildContinuityPacket(c.id), // E4.2
      },
    });
    await this.cases.execute(c.id, { type: 'transition', to: 'referral_sent', actor, owner: input.recipientOwner, reason: `Referral ${referral.id} offered` });
    // TODO E2.4: project ServiceRequest + Task via outbox (buildReferral in @loopclose/fhir).
    return referral;
  }

  async accept(referralId: string, schedulerOwner: Owner, actor: Actor) {
    const r = await this.prisma.referral.update({ where: { id: referralId }, data: { status: 'accepted', respondedAt: this.clock.now() } });
    await this.cases.execute(r.caseId, { type: 'transition', to: 'referral_accepted', actor, owner: schedulerOwner, reason: `Referral ${r.id} accepted` });
    return r;
  }

  async decline(referralId: string, reason: string, _actor: Actor) {
    const r = await this.prisma.referral.update({ where: { id: referralId }, data: { status: 'declined', declineReason: reason, respondedAt: this.clock.now() } });
    await this.escalations.handle({ type: 'referral.declined', caseId: r.caseId, meta: { reason } });
    return r;
  }

  /** Coordinator redirects a declined referral to another recipient. */
  async redirect(referralId: string, input: { recipientOrgId: string; recipientOwner: Owner }, actor: Actor) {
    const old = await this.prisma.referral.update({ where: { id: referralId }, data: { status: 'redirected' } });
    const next = await this.prisma.referral.create({
      data: { caseId: old.caseId, initiatorOrgId: old.initiatorOrgId, recipientOrgId: input.recipientOrgId, procedureCode: old.procedureCode, reason: old.reason, continuityPacket: old.continuityPacket ?? undefined },
    });
    await this.cases.execute(old.caseId, { type: 'transition', to: 'referral_sent', actor, owner: input.recipientOwner, loopReason: 'referral_declined', reason: `Redirected after decline (${old.declineReason ?? 'n/a'})` });
    return next;
  }

  /** E4.2 — structured bundle that travels with the case across organisations. */
  private async buildContinuityPacket(caseId: string) {
    const c = await this.prisma.case.findUniqueOrThrow({ where: { id: caseId }, include: { result: true, patient: true, messages: { where: { direction: 'outbound' }, orderBy: { createdAt: 'desc' }, take: 3 } } });
    return {
      version: 1,
      result: { loinc: c.result.loincCode, value: c.result.valueText, issuedAt: c.result.issuedAt, flags: c.result.flags },
      patient: { preferredLocale: c.patient.preferredLocale, transportBarrier: c.patient.transportBarrier, priorNoShows: c.patient.priorNoShows },
      whatPatientWasTold: c.messages.map((m) => ({ at: m.sentAt, templateId: m.templateId, locale: m.locale })),
      // TODO E4.2: meds, history, prior screens from FHIR; consent-scoped filtering (E12.2).
    };
  }
}
