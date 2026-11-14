import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Message, Prisma } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import type { Actor } from '@loopclose/shared';
import { PrismaService } from '../../common/prisma.service';
import { ClockService } from '../../common/clock.service';
import { JobsService } from '../../common/jobs.service';
import { ProgrammeRegistry } from '../../common/programme-registry.service';
import { SafetyGrader } from '../ai/grader/safety-grader.service';
import { AiFeatureFlags } from '../ai/feature-flags.service';
import { EscalationsService } from '../escalations/escalations.service';
import { ChannelRouter } from './channel-router.service';
import { MessagingService } from './messaging.service';
import { Locales, TemplateLibrary, type Locale, type MessageTemplate } from './template-library.service';

const Localized = z.object({ en: z.string(), ar: z.string(), ur: z.string(), hi: z.string() });
const LocalizedList = z.object({ any: z.array(z.string()).default([]), en: z.array(z.string()).default([]), ar: z.array(z.string()).default([]), ur: z.array(z.string()).default([]), hi: z.array(z.string()).default([]) }).partial();

const CommonSchema = z.object({
  version: z.string(),
  keywords: z.object({ emergency: LocalizedList, distress: LocalizedList, human: LocalizedList, unsure: LocalizedList }),
  messages: z.object({ emergency: Localized, distress: Localized, human: Localized, not_understood: Localized, question_forwarded: Localized, closing: Localized }),
  guardrails: z.object({ mustNotContain: z.array(z.string()).default([]) }),
});
const ScriptSchema = z.object({
  programme: z.string(),
  version: z.string(),
  approval: z.object({ status: z.enum(['draft', 'approved']), approvedBy: z.string().nullable(), approvedAt: z.string().nullable() }),
  teachBack: z.object({ passKeywords: LocalizedList }),
  messages: z.object({ teach_back_pass: Localized, re_explain: Localized }),
  faqs: z.array(z.object({ id: z.string(), keywords: LocalizedList, answer: Localized })).default([]),
});
type Common = z.infer<typeof CommonSchema>;
type Script = z.infer<typeof ScriptSchema>;
type KeywordList = z.infer<typeof LocalizedList>;

export type Intent = 'emergency' | 'distress' | 'human' | 'teach_back_pass' | 'teach_back_fail' | 'faq' | 'question';

export interface TurnResult {
  mode: 'rules' | 'disabled' | 'no_consent';
  intent: Intent | null;
  matched: string[];
  inbound: Message;
  replies: Message[];
  escalationRuleId?: string;
  proposalId?: string;
}

const QUESTION_START = /^\s*(when|what|where|how|why|is|are|does|do|will|can|could|should|who|which|متى|ما|ماذا|هل|أين|وين|كيف|لماذا|ليش|کب|کیا|کہاں|کیسے|کیوں|कब|क्या|कहाँ|कहां|कैसे|क्यों)\b/i;

/**
 * E5.4–E5.5 — Patient navigator, deterministic core. Works with no LLM configured:
 *  - opens the conversation with the clinician-approved result template + teach-back question;
 *  - routes every inbound message through safety keyword lists first (emergency > distress > human);
 *  - grades teach-back against per-programme concept keywords, re-explains once in simpler words,
 *    then hands off to a person; answers a small set of approved FAQs; forwards anything else.
 * Every outbound string passes the SafetyGrader (fail closed). The navigator never changes case state:
 * a passed teach-back becomes an `acknowledgement` AIProposal that a coordinator accepts (ADR-006).
 * Conversation state is derived from message history (templateId `nav:*`), so it survives restarts.
 */
@Injectable()
export class PatientNavigator implements OnModuleInit {
  private readonly log = new Logger(PatientNavigator.name);
  private common!: Common;
  private readonly scripts = new Map<string, Script>();
  readonly contactNumber = process.env.PROGRAMME_CONTACT_NUMBER ?? '800 5667';

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly jobs: JobsService,
    private readonly programmes: ProgrammeRegistry,
    private readonly grader: SafetyGrader,
    private readonly flags: AiFeatureFlags,
    private readonly escalations: EscalationsService,
    private readonly router: ChannelRouter,
    private readonly messaging: MessagingService,
    private readonly templates: TemplateLibrary,
  ) {}

  onModuleInit() {
    const root = process.env.NAVIGATOR_DIR ?? resolve(process.cwd(), '../../config/navigator');
    this.common = CommonSchema.parse(parseYaml(readFileSync(resolve(root, 'common.yaml'), 'utf8')));
    for (const p of this.programmes.list()) {
      const f = resolve(root, `${p.id}.yaml`);
      if (existsSync(f)) this.scripts.set(p.id, ScriptSchema.parse(parseYaml(readFileSync(f, 'utf8'))));
    }
    this.log.log(`Navigator scripts loaded: ${[...this.scripts.keys()].join(', ')} (${this.common.version})`);
  }

  scriptsInfo() {
    return [...this.scripts.values()].map((s) => ({ programme: s.programme, version: s.version, approval: s.approval, faqs: s.faqs.map((f) => f.id) }));
  }

  /** Coordinator starts the conversation: result notification (approved template) + teach-back question. */
  async start(caseId: string, actor: Actor) {
    const c = await this.loadCase(caseId);
    if (!['result_issued', 'patient_notified'].includes(c.state)) throw new BadRequestException(`Navigator can only start before acknowledgement (case is ${c.state})`);
    const template = this.templates.find(c.programmeId, 'result_issued');
    if (!template) throw new BadRequestException(`No result template for ${c.programmeId}`);
    const vars = await this.vars(c);
    const sent = await this.messaging.sendTemplate({ caseId, templateId: template.id, channel: 'web_chat', vars, actor });
    if (sent.blocked) return { blocked: true, verdict: sent.verdict };
    if (sent.delivery?.status === 'failed') {
      // Channel down: fall back to SMS with the same approved text; if that fails too, a person phones.
      const fb = await this.messaging.sendTemplate({ caseId, templateId: template.id, channel: 'sms', vars, actor });
      const tried = [sent.message!, ...(fb.message ? [fb.message] : [])];
      if (!fb.blocked && fb.delivery?.status !== 'failed') return { blocked: false, fallback: 'sms' as const, replies: tried };
      await this.escalate(caseId, 'message.delivery_failed', { reason: 'Result message could not be delivered by web chat or SMS' });
      return { blocked: false, undelivered: true, replies: tried };
    }
    const question = template.teachBack?.question[c.locale];
    const replies: Message[] = [sent.message!];
    if (question) {
      const q = await this.say(c, 'nav:teach_back', question, template);
      if (q) replies.push(q);
    }
    return { blocked: false, replies };
  }

  /** Inbound patient message → stored → one navigator turn. */
  async handleInbound(caseId: string, text: string, channel: Message['channel'] = 'web_chat'): Promise<TurnResult> {
    const c = await this.loadCase(caseId);
    const inbound = await this.prisma.message.create({
      data: { caseId, patientId: c.patientId, direction: 'inbound', channel, locale: detectLocale(text) ?? c.locale, text: text.slice(0, 2000), delivery: 'delivered', sentAt: this.clock.now() },
    });
    await this.jobs.recomputeRisk(caseId);

    // Human-only paths: kill switch off or patient declined AI-assisted communication.
    const aiConsent = c.patient.consents.find((k) => k.scope === 'ai_assisted_communication');
    const enabled = await this.flags.isEnabled('navigator');
    if (!enabled || (aiConsent && !aiConsent.granted)) {
      await this.escalate(caseId, 'message.question_unanswered', { reason: enabled ? 'Patient opted out of AI-assisted messaging' : 'AI navigator disabled' });
      return { mode: enabled ? 'no_consent' : 'disabled', intent: null, matched: [], inbound, replies: [] };
    }

    const script = this.scripts.get(c.programmeId);
    const lower = text.toLowerCase();
    const hits = (list: KeywordList | undefined) => matchAny(lower, list, c.locale);
    const replies: Message[] = [];
    const out = async (key: string, body: string) => {
      const m = await this.say(c, key, body);
      if (m) replies.push(m);
    };
    const vars = await this.vars(c);
    const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? '');
    const result = (intent: Intent, matched: string[], extra: Partial<TurnResult> = {}): TurnResult => ({ mode: 'rules', intent, matched, inbound, replies, ...extra });
    const audit = (intent: Intent, matched: string[]) =>
      this.prisma.auditLog.create({
        data: { actorKind: 'ai', actorId: 'navigator', action: 'ai.invoke', resource: 'Case', resourceId: caseId, patientId: c.patientId, aiFeature: 'navigator', aiModel: script?.version ?? this.common.version, outcome: intent, metadata: { matched, inboundId: inbound.id } },
      });

    // 1. Safety routing always runs first.
    let m = hits(this.common.keywords.emergency);
    if (m.length) {
      await out('nav:emergency', this.common.messages.emergency[c.locale]);
      await this.escalate(caseId, 'message.emergency_detected', { matched: m });
      await audit('emergency', m);
      return result('emergency', m, { escalationRuleId: 'patient-emergency' });
    }
    m = hits(this.common.keywords.distress);
    if (m.length) {
      await out('nav:distress', this.common.messages.distress[c.locale]);
      await this.escalate(caseId, 'message.distress_detected', { matched: m });
      await audit('distress', m);
      return result('distress', m, { escalationRuleId: 'patient-distress' });
    }
    const state = await this.conversationState(caseId);
    const isQuestion = /[?؟]/.test(text) || QUESTION_START.test(text);
    const faq = script?.faqs.map((f) => ({ f, m: hits(f.keywords) })).find((x) => x.m.length > 0);
    const human = hits(this.common.keywords.human);

    // 2. Teach-back (only while we are waiting for one, and the message is not a question).
    if (script && state.awaitingTeachBack && !isQuestion) {
      const unsure = hits(this.common.keywords.unsure);
      const pass = hits(script.teachBack.passKeywords);
      if (pass.length && !unsure.length) {
        await out('nav:teach_back_pass', script.messages.teach_back_pass[c.locale]);
        const proposal = await this.proposeAcknowledgement(c, text, pass, script.version);
        if (human.length) await this.escalate(caseId, 'message.human_requested', { matched: human });
        await audit('teach_back_pass', pass);
        return result('teach_back_pass', pass, proposal ? { proposalId: proposal.id } : {});
      }
      if (state.reExplained === 0) {
        await out('nav:re_explain', script.messages.re_explain[c.locale]);
        await audit('teach_back_fail', unsure);
        return result('teach_back_fail', unsure);
      }
      await out('nav:handoff_not_understood', this.common.messages.not_understood[c.locale]);
      await this.escalate(caseId, 'message.teach_back_failed', { matched: unsure });
      await audit('teach_back_fail', unsure);
      return result('teach_back_fail', unsure, { escalationRuleId: 'patient-not-understood' });
    }

    // 3. Explicit request for a person.
    if (human.length) {
      await out('nav:handoff_human', fill(this.common.messages.human[c.locale]));
      await this.escalate(caseId, 'message.human_requested', { matched: human });
      await audit('human', human);
      return result('human', human, { escalationRuleId: 'patient-human-request' });
    }

    // 4. Approved FAQ answers; then re-ask the teach-back question if we still need it.
    if (faq) {
      await out(`nav:faq:${faq.f.id}`, fill(faq.f.answer[c.locale]));
      if (state.awaitingTeachBack) {
        const q = this.templates.find(c.programmeId, 'result_issued')?.teachBack?.question[c.locale];
        if (q) await out('nav:teach_back', q);
      }
      await audit('faq', faq.m);
      return result('faq', faq.m);
    }

    // 5. Anything else goes to a person.
    await out('nav:question_forwarded', fill(this.common.messages.question_forwarded[c.locale]));
    await this.escalate(caseId, 'message.question_unanswered', { text: text.slice(0, 140) });
    await audit('question', []);
    return result('question', [], { escalationRuleId: 'patient-question' });
  }

  /** Derive where we are in the conversation from what the navigator has already sent. */
  private async conversationState(caseId: string) {
    const nav = await this.prisma.message.findMany({ where: { caseId, direction: 'outbound', templateId: { startsWith: 'nav:' } }, orderBy: { createdAt: 'asc' }, select: { templateId: true } });
    let awaitingTeachBack = false;
    let reExplained = 0;
    for (const { templateId } of nav) {
      if (templateId === 'nav:teach_back') awaitingTeachBack = true;
      else if (templateId === 'nav:re_explain') reExplained++;
      else if (templateId === 'nav:teach_back_pass' || templateId === 'nav:handoff_not_understood') {
        awaitingTeachBack = false;
        reExplained = 0;
      }
    }
    return { awaitingTeachBack, reExplained };
  }

  private async proposeAcknowledgement(c: LoadedCase, answer: string, matched: string[], model: string) {
    if (c.state !== 'patient_notified') return null;
    const existing = await this.prisma.aIProposal.findFirst({ where: { caseId: c.id, kind: 'acknowledgement', status: 'pending' } });
    if (existing) return existing;
    return this.prisma.aIProposal.create({
      data: {
        caseId: c.id,
        kind: 'acknowledgement',
        feature: 'navigator',
        model,
        payload: { proposedTransition: 'patient_acknowledged', teachBack: { answer: answer.slice(0, 500), matched, locale: c.locale, method: 'rules' } } as Prisma.InputJsonValue,
        sourceRefs: { programme: c.programmeId } as Prisma.InputJsonValue,
      },
    });
  }

  private async escalate(caseId: string, type: string, meta: Record<string, unknown>) {
    try {
      await this.escalations.handle({ type, caseId, meta });
    } catch (e) {
      this.log.error(`escalation ${type} failed for ${caseId}: ${String(e)}`);
    }
  }

  /** Grade and send one navigator message on web chat. Blocked text is stored as failed, never sent. */
  private async say(c: LoadedCase, key: string, text: string, template?: MessageTemplate): Promise<Message | null> {
    const pseudo: MessageTemplate = template ?? {
      id: key,
      programme: c.programmeId,
      stage: c.state,
      purpose: 'navigator',
      readingLevelTarget: 'grade6',
      variables: [],
      approval: { status: 'draft', approvedBy: null, approvedAt: null, reviewers: {} },
      body: { en: text, ar: text, ur: text, hi: text },
      guardrails: { mustNotContain: this.common.guardrails.mustNotContain, mustPreserve: [] },
    };
    const verdict = await this.grader.check({ text, locale: c.locale, template: pseudo, caseId: c.id });
    const base = { caseId: c.id, patientId: c.patientId, direction: 'outbound' as const, channel: 'web_chat' as const, locale: c.locale, templateId: key, text, graderVerdict: verdict as unknown as Prisma.InputJsonValue };
    if (!verdict.passed) {
      this.log.warn(`Grader blocked navigator message ${key} for ${c.id}: ${verdict.failedChecks.join(', ')}`);
      await this.prisma.message.create({ data: { ...base, delivery: 'failed' } });
      return null;
    }
    const delivery = await this.router.adapter('web_chat').send({ patientId: c.patientId, address: c.patient.phone ?? '' }, text);
    return this.prisma.message.create({ data: { ...base, delivery: delivery.status === 'failed' ? 'failed' : 'delivered', sentAt: this.clock.now() } });
  }

  private async loadCase(caseId: string) {
    const c = await this.prisma.case.findUniqueOrThrow({ where: { id: caseId }, include: { patient: { include: { consents: true } }, ownerOrg: true } });
    const locale = (Locales as readonly string[]).includes(c.patient.preferredLocale) ? (c.patient.preferredLocale as Locale) : 'en';
    return { ...c, locale };
  }

  async vars(c: LoadedCase): Promise<Record<string, string>> {
    const programme = this.programmes.get(c.programmeId);
    const fromCreation = addBusinessDays(c.createdAt, 7);
    const fromNow = addBusinessDays(this.clock.now(), 2);
    const target = fromCreation > fromNow ? fromCreation : fromNow;
    const intl = { en: 'en-GB', ar: 'ar-AE', ur: 'ur-PK', hi: 'hi-IN' }[c.locale];
    const programmeName: Record<Locale, Record<string, string>> = {
      en: { 'colorectal-fit': 'bowel screening', 'breast-birads': 'breast screening' },
      ar: { 'colorectal-fit': 'فحص الأمعاء', 'breast-birads': 'فحص الثدي' },
      ur: { 'colorectal-fit': 'آنتوں کی اسکریننگ', 'breast-birads': 'بریسٹ اسکریننگ' },
      hi: { 'colorectal-fit': 'आँत की स्क्रीनिंग', 'breast-birads': 'ब्रेस्ट स्क्रीनिंग' },
    };
    // Latin names/numbers inside Arabic or Urdu text: wrap in Unicode first-strong isolates so
    // punctuation and parentheses render in the right order on every device.
    const iso = (v: string) => (c.locale === 'ar' || c.locale === 'ur' ? `\u2068${v}\u2069` : v);
    const raw = {
      patientFirstName: c.patient.givenName,
      programmeName: programmeName[c.locale][c.programmeId] ?? programme.name,
      clinicName: c.ownerOrg?.name ?? 'your health centre',
      nextStepDeadline: new Intl.DateTimeFormat(intl, { weekday: 'long', day: 'numeric', month: 'long' }).format(target),
      contactNumber: this.contactNumber,
    };
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, iso(v)]));
  }
}

type LoadedCase = Awaited<ReturnType<PatientNavigator['loadCase']>>;

function matchAny(lower: string, list: KeywordList | undefined, locale: Locale): string[] {
  if (!list) return [];
  // Patients often reply in English or mix scripts, so English and `any` lists apply in every locale.
  const words = [...(list.any ?? []), ...(list[locale] ?? []), ...(locale !== 'en' ? (list.en ?? []) : [])];
  return [...new Set(words.filter((w) => lower.includes(w.toLowerCase())))];
}

function detectLocale(text: string): Locale | null {
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  if (/[ٹڈڑںےۓپچژگک]/.test(text)) return 'ur';
  if (/[؀-ۿ]/.test(text)) return 'ar';
  if (/[a-z]/i.test(text)) return 'en';
  return null;
}

function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) added++; // UAE federal weekend is Saturday–Sunday (since 2022)
  }
  return d;
}
