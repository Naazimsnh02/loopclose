import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Actor, Channel } from '@loopclose/shared';
import { PrismaService } from '../../common/prisma.service';
import { ClockService } from '../../common/clock.service';
import { TemplateLibrary, type Locale } from './template-library.service';
import { ChannelRouter } from './channel-router.service';
import { SafetyGrader } from '../ai/grader/safety-grader.service';
import { CasesService } from '../cases/cases.service';

@Injectable()
export class MessagingService {
  private readonly log = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly templates: TemplateLibrary,
    private readonly router: ChannelRouter,
    private readonly grader: SafetyGrader,
    private readonly cases: CasesService,
  ) {}

  /**
   * Send a template-bound message. Order of checks: consent → template approval → render →
   * safety grader → channel send → persist + outreach attempt on the case.
   */
  async sendTemplate(input: { caseId: string; templateId: string; channel: Channel; vars: Record<string, string>; actor: Actor }) {
    const c = await this.prisma.case.findUniqueOrThrow({ where: { id: input.caseId }, include: { patient: { include: { consents: true } } } });
    const locale = c.patient.preferredLocale as Locale;

    const consent = c.patient.consents.find((k) => k.scope === `messaging:${input.channel}`);
    if (consent && !consent.granted) throw new ForbiddenException(`Patient opted out of ${input.channel}`);

    const template = this.templates.get(input.templateId);
    if (!this.templates.isSendable(template)) throw new ForbiddenException(`Template ${template.id} is not approved`);
    const text = this.templates.render(template, locale, input.vars);

    const verdict = await this.grader.check({ text, locale, template, caseId: c.id });
    if (!verdict.passed) {
      this.log.warn(`Grader blocked message for case ${c.id}: ${verdict.failedChecks.join(', ')}`);
      await this.prisma.message.create({ data: { caseId: c.id, patientId: c.patientId, direction: 'outbound', channel: input.channel, locale, templateId: template.id, text, graderVerdict: verdict as unknown as Prisma.InputJsonValue, delivery: 'failed' } });
      // TODO E5.6: route to human review queue (AIProposal kind=patient_message).
      return { blocked: true, verdict };
    }

    const address = input.channel === 'email' ? (c.patient.email ?? '') : (c.patient.phone ?? '');
    const delivery = await this.router.adapter(input.channel).send({ patientId: c.patientId, address }, text);
    const message = await this.prisma.message.create({
      data: { caseId: c.id, patientId: c.patientId, direction: 'outbound', channel: input.channel, locale, templateId: template.id, text, graderVerdict: verdict as unknown as Prisma.InputJsonValue, delivery: delivery.status === 'failed' ? 'failed' : 'delivered', sentAt: this.clock.now() },
    });
    await this.cases.execute(c.id, { type: 'record_outreach', actor: input.actor, attempt: { channel: input.channel, at: this.clock.now().toISOString(), outcome: delivery.status === 'failed' ? 'failed' : 'delivered' } });
    if (c.state === 'result_issued' && delivery.status !== 'failed') {
      await this.cases.execute(c.id, { type: 'transition', to: 'patient_notified', actor: { kind: 'system', id: 'messaging' }, reason: `Notified via ${input.channel}` });
    }
    return { blocked: false, message, delivery };
  }

  /** Inbound webhook (simulated channels + web chat). Navigator handles the turn (E5.4). */
  async receive(input: { caseId: string; channel: Channel; text: string }) {
    const c = await this.prisma.case.findUniqueOrThrow({ where: { id: input.caseId } });
    return this.prisma.message.create({ data: { caseId: c.id, patientId: c.patientId, direction: 'inbound', channel: input.channel, locale: 'und', text: input.text, delivery: 'delivered', sentAt: this.clock.now() } });
  }

  history(caseId: string) {
    return this.prisma.message.findMany({ where: { caseId }, orderBy: { createdAt: 'asc' } });
  }
}
