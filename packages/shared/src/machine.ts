/**
 * Case state machine. Pure function: (snapshot, command, programme, now) -> Result<{snapshot, events}>.
 *
 * Invariants enforced here (and only here, so persistence can trust them):
 *  1. Transitions must follow the programme graph (self-loops only for no-show / referral redirect).
 *  2. A non-terminal case always has an owner whose role matches the state's ownerRole.
 *  3. AI actors may only enter states listed in aiPolicy.mayEnterStates, never assign owners,
 *     never close, never exit.
 *  4. Closure requires programme-valid evidence OR an authorised human decision with a reason.
 *  5. lost_to_follow_up requires the outreach protocol to be exhausted; declined_by_patient needs justification.
 */
import { deadlineForState } from './sla.js';
import { getState, isTerminal, type ProgrammeDefinition } from './programme.js';
import {
  MachineError,
  type ApplyOutcome,
  type CaseCommand,
  type CaseEvent,
  type CaseSnapshot,
  type Owner,
  type Result,
  type UrgencyTier,
} from './types.js';

const fail = (code: MachineError['code'], message: string, details?: Record<string, unknown>): Result<never> => ({
  ok: false,
  error: new MachineError(code, message, details),
});

export interface CreateCaseInput {
  id: string;
  programme: ProgrammeDefinition;
  tier: UrgencyTier;
  owner: Owner;
  now: Date;
}

/** Creates a new case in the programme's initial state. */
export function createCase(input: CreateCaseInput): Result<ApplyOutcome> {
  const { programme, now } = input;
  const initial = getState(programme, programme.initialState)!;
  if (initial.ownerRole && input.owner.role !== initial.ownerRole) {
    return fail('OWNER_ROLE_MISMATCH', `Initial owner must have role ${initial.ownerRole}`, {
      expected: initial.ownerRole,
      actual: input.owner.role,
    });
  }
  const iso = now.toISOString();
  const deadline = deadlineForState(programme, initial, input.tier, { stateEnteredAt: now, caseCreatedAt: now });
  const snapshot: CaseSnapshot = {
    id: input.id,
    programmeId: programme.id,
    state: initial.id,
    tier: input.tier,
    owner: input.owner,
    version: 1,
    createdAt: iso,
    enteredStateAt: iso,
    slaDeadlineAt: deadline ? deadline.toISOString() : null,
    evidence: [],
    outreachAttempts: [],
    noShowCount: 0,
    referralDeclineCount: 0,
  };
  const events: CaseEvent[] = [
    { type: 'case.owner_assigned', owner: input.owner, previous: null, actor: { kind: 'system', id: 'engine' }, at: iso },
  ];
  if (deadline) events.push({ type: 'sla.scheduled', state: initial.id, deadlineAt: deadline.toISOString(), at: iso });
  return { ok: true, value: { snapshot, events } };
}

export function applyCommand(
  snapshot: CaseSnapshot,
  command: CaseCommand,
  programme: ProgrammeDefinition,
  now: Date,
): Result<ApplyOutcome> {
  const current = getState(programme, snapshot.state);
  if (!current) return fail('UNKNOWN_STATE', `Unknown state ${snapshot.state}`);
  const iso = now.toISOString();
  const bump = (s: CaseSnapshot): CaseSnapshot => ({ ...s, version: s.version + 1 });

  switch (command.type) {
    case 'record_outreach': {
      if (isTerminal(programme, snapshot.state)) return fail('TERMINAL_STATE', 'Case is terminal');
      const next = bump({ ...snapshot, outreachAttempts: [...snapshot.outreachAttempts, command.attempt] });
      return ok(next, [{ type: 'case.outreach_recorded', attempt: command.attempt, actor: command.actor, at: iso }]);
    }

    case 'attach_evidence': {
      if (isTerminal(programme, snapshot.state)) return fail('TERMINAL_STATE', 'Case is terminal');
      if (!programme.closure.evidenceTypes.includes(command.evidence.type)) {
        return fail('CLOSURE_EVIDENCE_TYPE_INVALID', `Evidence type ${command.evidence.type} not allowed`, {
          allowed: programme.closure.evidenceTypes,
        });
      }
      const next = bump({ ...snapshot, evidence: [...snapshot.evidence, command.evidence] });
      return ok(next, [{ type: 'case.evidence_attached', evidence: command.evidence, actor: command.actor, at: iso }]);
    }

    case 'assign_owner': {
      if (isTerminal(programme, snapshot.state)) return fail('TERMINAL_STATE', 'Case is terminal');
      if (command.actor.kind === 'ai') return fail('AI_FORBIDDEN', 'AI actors cannot assign owners');
      if (current.ownerRole && command.owner.role !== current.ownerRole) {
        return fail('OWNER_ROLE_MISMATCH', `State ${current.id} requires owner role ${current.ownerRole}`, {
          expected: current.ownerRole,
          actual: command.owner.role,
        });
      }
      const next = bump({ ...snapshot, owner: command.owner });
      return ok(next, [
        { type: 'case.owner_assigned', owner: command.owner, previous: snapshot.owner, actor: command.actor, at: iso },
      ]);
    }

    case 'transition': {
      if (isTerminal(programme, snapshot.state)) return fail('TERMINAL_STATE', 'Case is terminal');
      const target = getState(programme, command.to);
      if (!target) return fail('UNKNOWN_STATE', `Unknown target state ${command.to}`);
      if (!current.next.includes(command.to)) {
        return fail('INVALID_TRANSITION', `Cannot go from ${current.id} to ${command.to}`, { allowed: current.next });
      }
      // Terminal states are reached only via close/exit commands, never plain transitions.
      if (isTerminal(programme, command.to)) {
        return fail('INVALID_TRANSITION', `Use close/exit commands to reach terminal state ${command.to}`);
      }
      if (command.actor.kind === 'ai') {
        if (!programme.aiPolicy.mayEnterStates.includes(command.to)) {
          return fail('AI_FORBIDDEN', `AI actor may not enter state ${command.to}`, {
            allowed: programme.aiPolicy.mayEnterStates,
          });
        }
        if (command.owner) return fail('AI_FORBIDDEN', 'AI actors cannot assign owners');
      }

      // Resolve owner for the target state.
      let owner: Owner | null = snapshot.owner;
      if (command.owner) {
        if (target.ownerRole && command.owner.role !== target.ownerRole) {
          return fail('OWNER_ROLE_MISMATCH', `State ${target.id} requires owner role ${target.ownerRole}`, {
            expected: target.ownerRole,
            actual: command.owner.role,
          });
        }
        owner = command.owner;
      } else if (target.ownerRole && owner?.role !== target.ownerRole) {
        return fail('OWNER_REQUIRED', `Entering ${target.id} requires an owner with role ${target.ownerRole}`, {
          expected: target.ownerRole,
          current: owner?.role ?? null,
        });
      }
      if (!owner) return fail('OWNER_REQUIRED', 'Non-terminal states require an owner');

      const isSelfLoop = command.to === current.id;
      let noShowCount = snapshot.noShowCount;
      let referralDeclineCount = snapshot.referralDeclineCount;
      const events: CaseEvent[] = [];
      if (isSelfLoop) {
        if (command.loopReason === 'no_show') {
          noShowCount += 1;
          events.push({ type: 'appointment.no_show', count: noShowCount, at: iso });
        } else if (command.loopReason === 'referral_declined') {
          referralDeclineCount += 1;
          events.push({ type: 'referral.declined', count: referralDeclineCount, at: iso });
        } else {
          return fail('INVALID_TRANSITION', 'Self-loop transitions require a loopReason');
        }
      }

      const deadline = deadlineForState(programme, target, snapshot.tier, {
        stateEnteredAt: now,
        caseCreatedAt: new Date(snapshot.createdAt),
      });
      const next = bump({
        ...snapshot,
        state: target.id,
        owner,
        enteredStateAt: iso,
        slaDeadlineAt: deadline ? deadline.toISOString() : null,
        noShowCount,
        referralDeclineCount,
      });
      const transitioned: CaseEvent = {
        type: 'case.transitioned',
        from: current.id,
        to: target.id,
        actor: command.actor,
        at: iso,
        ...(command.reason !== undefined ? { reason: command.reason } : {}),
      };
      events.unshift(transitioned);
      if (command.owner && (snapshot.owner?.id !== command.owner.id || snapshot.owner?.role !== command.owner.role)) {
        events.push({ type: 'case.owner_assigned', owner: command.owner, previous: snapshot.owner, actor: command.actor, at: iso });
      }
      if (deadline) events.push({ type: 'sla.scheduled', state: target.id, deadlineAt: deadline.toISOString(), at: iso });
      return ok(next, events);
    }

    case 'close': {
      if (isTerminal(programme, snapshot.state)) return fail('TERMINAL_STATE', 'Case is terminal');
      if (command.actor.kind !== 'human') {
        return fail('AI_FORBIDDEN', 'Only an authorised human can close a case');
      }
      if (!programme.closure.fromStates.includes(snapshot.state)) {
        return fail('CLOSURE_NOT_ALLOWED_FROM_STATE', `Cannot close from ${snapshot.state}`, {
          allowed: programme.closure.fromStates,
        });
      }
      const newEvidence = command.evidence ?? [];
      for (const e of newEvidence) {
        if (!programme.closure.evidenceTypes.includes(e.type)) {
          return fail('CLOSURE_EVIDENCE_TYPE_INVALID', `Evidence type ${e.type} not allowed`, {
            allowed: programme.closure.evidenceTypes,
          });
        }
      }
      const allEvidence = [...snapshot.evidence, ...newEvidence];
      const hasDecision = !!command.humanDecision && command.humanDecision.reason.trim().length > 0;
      if (allEvidence.length === 0 && !hasDecision) {
        return fail('CLOSURE_EVIDENCE_REQUIRED', 'Closure requires evidence or a documented human decision');
      }
      const next = bump({
        ...snapshot,
        state: 'closed',
        owner: null,
        enteredStateAt: iso,
        slaDeadlineAt: null,
        evidence: allEvidence,
      });
      const events: CaseEvent[] = newEvidence.map((e) => ({
        type: 'case.evidence_attached' as const,
        evidence: e,
        actor: command.actor,
        at: iso,
      }));
      events.push({ type: 'case.transitioned', from: snapshot.state, to: 'closed', actor: command.actor, at: iso });
      events.push({
        type: 'case.closed',
        actor: command.actor,
        evidenceCount: allEvidence.length,
        at: iso,
        ...(command.humanDecision ? { humanDecision: command.humanDecision } : {}),
      });
      return ok(next, events);
    }

    case 'exit': {
      if (isTerminal(programme, snapshot.state)) return fail('TERMINAL_STATE', 'Case is terminal');
      if (command.actor.kind !== 'human') return fail('AI_FORBIDDEN', 'Only a human can exit a case');
      if (command.justification.trim().length === 0) {
        return fail('EXIT_JUSTIFICATION_REQUIRED', 'Exit requires a justification');
      }
      const rule = programme.exits[command.kind];
      if (!rule.fromStates.includes(snapshot.state)) {
        return fail('EXIT_NOT_ALLOWED_FROM_STATE', `Cannot exit (${command.kind}) from ${snapshot.state}`, {
          allowed: rule.fromStates,
        });
      }
      if (command.kind === 'lost_to_follow_up') {
        const ltf = programme.exits.lost_to_follow_up;
        const attempts = snapshot.outreachAttempts;
        const channels = new Set(attempts.map((a) => a.channel));
        const phoneTried = attempts.some((a) => a.channel === 'phone');
        if (
          attempts.length < ltf.minOutreachAttempts ||
          channels.size < ltf.minDistinctChannels ||
          (ltf.requirePhoneAttempt && !phoneTried)
        ) {
          return fail('EXIT_OUTREACH_PROTOCOL_NOT_EXHAUSTED', 'Outreach protocol not exhausted', {
            attempts: attempts.length,
            distinctChannels: channels.size,
            phoneTried,
            required: ltf,
          });
        }
      }
      const next = bump({ ...snapshot, state: command.kind, owner: null, enteredStateAt: iso, slaDeadlineAt: null });
      return ok(next, [
        { type: 'case.transitioned', from: snapshot.state, to: command.kind, actor: command.actor, at: iso },
        { type: 'case.exited', kind: command.kind, actor: command.actor, justification: command.justification, at: iso },
      ]);
    }
  }
}

function ok(snapshot: CaseSnapshot, events: CaseEvent[]): Result<ApplyOutcome> {
  return { ok: true, value: { snapshot, events } };
}

/** Evaluate programme urgency rules against result flags/age. Highest tier wins. */
export function resolveTier(
  programme: ProgrammeDefinition,
  input: { flags: string[]; age?: number },
): UrgencyTier {
  const rank: Record<UrgencyTier, number> = { routine: 0, priority: 1, urgent: 2 };
  let tier: UrgencyTier = 'routine';
  for (const rule of programme.urgencyRules) {
    const flagHit = rule.when.flag !== undefined && input.flags.includes(rule.when.flag);
    const ageHit = rule.when.ageGte !== undefined && input.age !== undefined && input.age >= rule.when.ageGte;
    if ((flagHit || ageHit) && rank[rule.tier] > rank[tier]) tier = rule.tier;
  }
  return tier;
}
