import { z } from 'zod';
import { parse as parseYaml } from 'yaml';

/** One SLA window. Exactly one of hours/days/businessDays is expected. */
export const SlaWindowSchema = z
  .object({
    hours: z.number().positive().optional(),
    days: z.number().positive().optional(),
    businessDays: z.number().positive().optional(),
    /** Measure from state entry (default) or from case creation (e.g. "31 days to colonoscopy"). */
    from: z.enum(['state_entered', 'case_created']).default('state_entered'),
  })
  .refine(
    (w) => [w.hours, w.days, w.businessDays].filter((v) => v !== undefined).length === 1,
    { message: 'SLA window must set exactly one of hours, days, businessDays' },
  );
export type SlaWindow = z.infer<typeof SlaWindowSchema>;

export const TierSlaSchema = z.object({
  routine: SlaWindowSchema,
  priority: SlaWindowSchema,
  urgent: SlaWindowSchema,
});

export const StateDefinitionSchema = z.object({
  id: z.string().min(1),
  stage: z.enum([
    'issued',
    'notified',
    'acknowledged',
    'consulted',
    'referred',
    'referral_accepted',
    'appointment',
    'confirmatory',
    'treatment',
    'closed',
    'exited',
  ]),
  ownerRole: z.string().nullable(),
  next: z.array(z.string()),
  sla: TierSlaSchema.optional(),
  escalateTo: z.string().optional(),
  onBreach: z.string().optional(),
});
export type StateDefinition = z.infer<typeof StateDefinitionSchema>;

export const ProgrammeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.string(),
    initialState: z.string(),
    terminalStates: z.array(z.string()).min(1),
    calendar: z.object({
      businessDays: z.array(z.number().int().min(0).max(6)).min(1),
      holidays: z.array(z.string()).default([]), // YYYY-MM-DD
    }),
    states: z.array(StateDefinitionSchema).min(2),
    closure: z.object({
      fromStates: z.array(z.string()).min(1),
      evidenceTypes: z.array(z.string()).min(1),
      requireEvidenceOrHumanDecision: z.literal(true),
    }),
    exits: z.object({
      declined_by_patient: z.object({
        fromStates: z.array(z.string()).min(1),
        requireJustification: z.literal(true),
      }),
      lost_to_follow_up: z.object({
        fromStates: z.array(z.string()).min(1),
        minOutreachAttempts: z.number().int().min(1),
        minDistinctChannels: z.number().int().min(1),
        requirePhoneAttempt: z.boolean().default(true),
      }),
    }),
    aiPolicy: z.object({
      mayEnterStates: z.array(z.string()).default([]),
      mayAssignOwners: z.literal(false),
      mayClose: z.literal(false),
    }),
    urgencyRules: z
      .array(
        z.object({
          id: z.string(),
          when: z.object({ flag: z.string().optional(), ageGte: z.number().optional() }),
          tier: z.enum(['routine', 'priority', 'urgent']),
        }),
      )
      .default([]),
  })
  .superRefine((p, ctx) => {
    const ids = new Set(p.states.map((s) => s.id));
    const check = (id: string, path: string) => {
      if (!ids.has(id)) ctx.addIssue({ code: 'custom', message: `Unknown state "${id}"`, path: [path] });
    };
    check(p.initialState, 'initialState');
    p.terminalStates.forEach((s) => check(s, 'terminalStates'));
    p.states.forEach((s) => s.next.forEach((n) => check(n, `states.${s.id}.next`)));
    p.closure.fromStates.forEach((s) => check(s, 'closure.fromStates'));
    p.exits.declined_by_patient.fromStates.forEach((s) => check(s, 'exits.declined_by_patient'));
    p.exits.lost_to_follow_up.fromStates.forEach((s) => check(s, 'exits.lost_to_follow_up'));
    p.aiPolicy.mayEnterStates.forEach((s) => check(s, 'aiPolicy.mayEnterStates'));
    for (const s of p.states) {
      const terminal = p.terminalStates.includes(s.id);
      if (!terminal && s.ownerRole === null) {
        ctx.addIssue({ code: 'custom', message: `Non-terminal state "${s.id}" must have an ownerRole`, path: ['states'] });
      }
      if (!terminal && !s.sla) {
        ctx.addIssue({ code: 'custom', message: `Non-terminal state "${s.id}" must define sla`, path: ['states'] });
      }
      if (terminal && s.next.length > 0) {
        ctx.addIssue({ code: 'custom', message: `Terminal state "${s.id}" cannot have next states`, path: ['states'] });
      }
    }
    // AI may never enter a terminal state regardless of configuration.
    for (const s of p.aiPolicy.mayEnterStates) {
      if (p.terminalStates.includes(s)) {
        ctx.addIssue({ code: 'custom', message: `aiPolicy.mayEnterStates may not include terminal state "${s}"`, path: ['aiPolicy'] });
      }
    }
  });

export type ProgrammeDefinition = z.infer<typeof ProgrammeSchema>;

export function parseProgramme(input: unknown): ProgrammeDefinition {
  return ProgrammeSchema.parse(input);
}

export function parseProgrammeYaml(yamlText: string): ProgrammeDefinition {
  return parseProgramme(parseYaml(yamlText));
}

export function getState(programme: ProgrammeDefinition, id: string): StateDefinition | undefined {
  return programme.states.find((s) => s.id === id);
}

export function isTerminal(programme: ProgrammeDefinition, id: string): boolean {
  return programme.terminalStates.includes(id);
}
