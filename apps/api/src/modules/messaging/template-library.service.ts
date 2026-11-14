import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

export const Locales = ['en', 'ar', 'ur', 'hi'] as const;
export type Locale = (typeof Locales)[number];

const LocalizedSchema = z.object({ en: z.string(), ar: z.string(), ur: z.string(), hi: z.string() });

export const TemplateSchema = z.object({
  id: z.string(),
  programme: z.string(),
  stage: z.string(),
  purpose: z.string(),
  readingLevelTarget: z.string(),
  variables: z.array(z.string()),
  approval: z.object({
    status: z.enum(['draft', 'approved']),
    approvedBy: z.string().nullable(),
    approvedAt: z.string().nullable(),
    reviewers: z.record(z.string()).default({}),
  }),
  teachBack: z.object({ question: LocalizedSchema, passCriteria: z.string() }).optional(),
  body: LocalizedSchema,
  guardrails: z.object({ mustNotContain: z.array(z.string()).default([]), mustPreserve: z.array(z.string()).default([]) }).default({ mustNotContain: [], mustPreserve: [] }),
});
export type MessageTemplate = z.infer<typeof TemplateSchema>;

/** The only source of patient-facing text (E5.1). Unapproved templates are blocked outside DEMO_MODE. */
@Injectable()
export class TemplateLibrary implements OnModuleInit {
  private readonly log = new Logger(TemplateLibrary.name);
  private readonly templates = new Map<string, MessageTemplate>();

  onModuleInit() {
    const root = process.env.TEMPLATES_DIR ?? resolve(process.cwd(), '../../config/templates/messages');
    for (const programme of readdirSync(root)) {
      const dir = join(root, programme);
      if (!statSync(dir).isDirectory()) continue;
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.yaml'))) {
        const t = TemplateSchema.parse(parseYaml(readFileSync(join(dir, file), 'utf8')));
        this.templates.set(t.id, t);
      }
    }
    this.log.log(`Loaded ${this.templates.size} message templates`);
  }

  get(id: string): MessageTemplate {
    const t = this.templates.get(id);
    if (!t) throw new NotFoundException(`Template ${id} not found`);
    return t;
  }

  find(programme: string, stage: string): MessageTemplate | undefined {
    return [...this.templates.values()].find((t) => t.programme === programme && t.stage === stage);
  }

  list(): MessageTemplate[] {
    return [...this.templates.values()];
  }

  /** Simple {{var}} substitution; missing variables throw so we never send half-filled text. */
  render(t: MessageTemplate, locale: Locale, vars: Record<string, string>): string {
    const missing = t.variables.filter((v) => !(v in vars));
    if (missing.length) throw new Error(`Template ${t.id} missing variables: ${missing.join(', ')}`);
    return t.body[locale].replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? '');
  }

  isSendable(t: MessageTemplate): boolean {
    return t.approval.status === 'approved' || process.env.DEMO_MODE === 'true';
  }
}
