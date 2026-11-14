import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../common/prisma.service';

export type AiFeature = 'navigator' | 'summariser' | 'risk' | 'grader';

export interface LlmCall {
  feature: AiFeature;
  caseId?: string;
  system: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  maxTokens?: number;
  /** Lower temperature for grading/classification; navigator uses default. */
  temperature?: number;
}

/**
 * Single choke point for every model call (ADR-008): model selection by feature, audit logging with
 * prompt hash (never raw prompt), token accounting, graceful degradation when the key is missing.
 */
@Injectable()
export class LlmClient {
  private readonly log = new Logger(LlmClient.name);
  private readonly client: Anthropic | null;

  constructor(private readonly prisma: PrismaService) {
    this.client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
    if (!this.client) this.log.warn('ANTHROPIC_API_KEY not set — AI features run in template-only/rules-only degraded mode');
  }

  get available(): boolean {
    return this.client !== null;
  }

  modelFor(feature: AiFeature): string {
    switch (feature) {
      case 'grader':
        return process.env.AI_GRADER_MODEL ?? 'claude-haiku-5-5';
      case 'summariser':
        return process.env.AI_SUMMARISER_MODEL ?? 'claude-sonnet-5-5';
      case 'navigator':
      case 'risk':
      default:
        return process.env.AI_NAVIGATOR_MODEL ?? 'claude-sonnet-5-5';
    }
  }

  async call(input: LlmCall): Promise<Anthropic.Message> {
    if (!this.client) throw new Error('LLM unavailable');
    const model = this.modelFor(input.feature);
    const promptHash = createHash('sha256').update(JSON.stringify({ s: input.system, m: input.messages })).digest('hex');
    const started = Date.now();
    try {
      const res = await this.client.messages.create({
        model,
        max_tokens: input.maxTokens ?? 1024,
        system: input.system,
        messages: input.messages,
        ...(input.tools ? { tools: input.tools } : {}),
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
      });
      await this.audit({ feature: input.feature, model, promptHash, caseId: input.caseId, outcome: 'success', tokensIn: res.usage.input_tokens, tokensOut: res.usage.output_tokens, latencyMs: Date.now() - started });
      return res;
    } catch (e) {
      await this.audit({ feature: input.feature, model, promptHash, caseId: input.caseId, outcome: 'error', latencyMs: Date.now() - started, error: (e as Error).message });
      throw e;
    }
  }

  private async audit(a: { feature: AiFeature; model: string; promptHash: string; caseId?: string; outcome: string; tokensIn?: number; tokensOut?: number; latencyMs: number; error?: string }) {
    await this.prisma.auditLog.create({
      data: {
        actorKind: 'ai',
        actorId: a.feature,
        action: 'ai.invoke',
        resource: 'Case',
        resourceId: a.caseId ?? null,
        aiFeature: a.feature,
        aiModel: a.model,
        promptHash: a.promptHash,
        tokensIn: a.tokensIn ?? null,
        tokensOut: a.tokensOut ?? null,
        outcome: a.outcome,
        metadata: { latencyMs: a.latencyMs, ...(a.error ? { error: a.error } : {}) },
      },
    });
    // TODO E2.4: project to FHIR AuditEvent via outbox (buildAiAuditEvent).
  }
}
