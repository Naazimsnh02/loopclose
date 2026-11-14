import { Injectable } from '@nestjs/common';
import { LlmClient } from '../llm.client';
import { AiFeatureFlags } from '../feature-flags.service';
import { PrismaService } from '../../../common/prisma.service';

/**
 * E6.1 — Hand-off summariser. Input is structured FHIR/DB data only (never free text from the patient
 * channel). Output is a draft `Composition` where every sentence carries source references; the
 * faithfulness check flags any sentence that cannot be traced. A clinician edits and approves.
 */
@Injectable()
export class SummariserService {
  constructor(
    private readonly llm: LlmClient,
    private readonly flags: AiFeatureFlags,
    private readonly prisma: PrismaService,
  ) {}

  async draft(caseId: string) {
    await this.flags.assertEnabled('summariser');
    const c = await this.prisma.case.findUniqueOrThrow({ where: { id: caseId }, include: { result: true, patient: true, messages: { where: { direction: 'outbound' } }, appointments: true } });
    const sources = {
      'src:result': { loinc: c.result.loincCode, value: c.result.valueText, issuedAt: c.result.issuedAt, flags: c.result.flags },
      'src:patient': { age: ageOf(c.patient.birthDate), sex: c.patient.sex, locale: c.patient.preferredLocale, transportBarrier: c.patient.transportBarrier, priorNoShows: c.patient.priorNoShows },
      'src:communications': c.messages.map((m) => ({ at: m.sentAt, templateId: m.templateId, locale: m.locale })),
      'src:appointments': c.appointments.map((a) => ({ at: a.scheduledAt, status: a.status })),
    };
    if (!this.llm.available) {
      return this.prisma.aIProposal.create({ data: { caseId, kind: 'handoff_summary', feature: 'summariser', model: 'none', payload: { sections: [], degraded: true }, sourceRefs: sources } });
    }
    const res = await this.llm.call({
      feature: 'summariser',
      caseId,
      temperature: 0,
      system: SUMMARISER_SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(sources) }],
    });
    const text = res.content.find((b) => b.type === 'text')?.text ?? '{"sections":[]}';
    const payload = JSON.parse(text) as { sections: Array<{ heading: string; sentences: Array<{ text: string; sources: string[] }> }> };
    const untraced = payload.sections.flatMap((s) => s.sentences.filter((x) => x.sources.length === 0 || x.sources.some((r) => !(r in sources))));
    return this.prisma.aIProposal.create({
      data: { caseId, kind: 'handoff_summary', feature: 'summariser', model: this.llm.modelFor('summariser'), payload: { ...payload, faithfulness: { untracedCount: untraced.length, untraced } }, sourceRefs: sources },
    });
  }
}

const SUMMARISER_SYSTEM = `You draft a clinician-to-clinician referral summary from STRUCTURED data only.
Return ONLY JSON: {"sections":[{"heading":string,"sentences":[{"text":string,"sources":[string]}]}]}.
Every sentence must cite one or more source keys from the input (e.g. "src:result"). Do not infer diagnoses.
Do not include anything not present in the input. Headings: Reason for referral, Result, Patient context, Communication so far, Open questions.`;

function ageOf(birthDate: Date): number {
  return Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 86_400_000));
}
