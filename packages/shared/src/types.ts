/**
 * Core domain types. These are deliberately I/O-free so the state machine can be
 * exercised in unit tests and reused by api, web, and analytics exporters.
 */

export type ActorKind = 'human' | 'system' | 'ai';

export interface Actor {
  kind: ActorKind;
  /** User id, service name, or AI feature name (e.g. "navigator"). */
  id: string;
  /** RBAC role for humans (coordinator, phc_clinician, ...). */
  role?: string;
  organizationId?: string;
}

export type UrgencyTier = 'routine' | 'priority' | 'urgent';

export type Channel = 'web_chat' | 'whatsapp' | 'sms' | 'email' | 'phone';

export interface OutreachAttempt {
  channel: Channel;
  at: string; // ISO datetime
  outcome: 'delivered' | 'failed' | 'no_response' | 'reached';
}

export interface Evidence {
  /** Programme-specific evidence type, e.g. "colonoscopy_report". */
  type: string;
  /** FHIR reference or document id. */
  reference: string;
  recordedBy: Actor;
  recordedAt: string;
}

export interface HumanDecision {
  actor: Actor;
  reason: string;
  decidedAt: string;
}

export interface Owner {
  id: string;
  role: string;
  organizationId?: string;
}

/**
 * The minimal, serialisable view of a case the state machine needs.
 * Persistence adds ids, timestamps, FHIR links, etc. on top.
 */
export interface CaseSnapshot {
  id: string;
  programmeId: string;
  state: string;
  tier: UrgencyTier;
  owner: Owner | null;
  /** Optimistic-concurrency version; incremented per applied command. */
  version: number;
  createdAt: string;
  enteredStateAt: string;
  /** Deadline for the current state (ISO) or null for terminal states. */
  slaDeadlineAt: string | null;
  evidence: Evidence[];
  outreachAttempts: OutreachAttempt[];
  noShowCount: number;
  referralDeclineCount: number;
}

export type ExitKind = 'declined_by_patient' | 'lost_to_follow_up';

export type CaseCommand =
  | {
      type: 'transition';
      to: string;
      actor: Actor;
      reason?: string;
      /** New owner when the target state's ownerRole differs or the owner must change. */
      owner?: Owner;
      /** Marks a self-loop transition cause (no-show rebook, referral redirect). */
      loopReason?: 'no_show' | 'referral_declined';
    }
  | { type: 'assign_owner'; owner: Owner; actor: Actor; reason?: string }
  | { type: 'record_outreach'; attempt: OutreachAttempt; actor: Actor }
  | { type: 'attach_evidence'; evidence: Evidence; actor: Actor }
  | {
      type: 'close';
      actor: Actor;
      evidence?: Evidence[];
      humanDecision?: HumanDecision;
    }
  | { type: 'exit'; kind: ExitKind; actor: Actor; justification: string };

export type CaseEvent =
  | { type: 'case.transitioned'; from: string; to: string; actor: Actor; reason?: string; at: string }
  | { type: 'case.owner_assigned'; owner: Owner; previous: Owner | null; actor: Actor; at: string }
  | { type: 'case.outreach_recorded'; attempt: OutreachAttempt; actor: Actor; at: string }
  | { type: 'case.evidence_attached'; evidence: Evidence; actor: Actor; at: string }
  | { type: 'case.closed'; actor: Actor; evidenceCount: number; humanDecision?: HumanDecision; at: string }
  | { type: 'case.exited'; kind: ExitKind; actor: Actor; justification: string; at: string }
  | { type: 'sla.scheduled'; state: string; deadlineAt: string; at: string }
  | { type: 'appointment.no_show'; count: number; at: string }
  | { type: 'referral.declined'; count: number; at: string };

export type MachineErrorCode =
  | 'INVALID_TRANSITION'
  | 'TERMINAL_STATE'
  | 'OWNER_REQUIRED'
  | 'OWNER_ROLE_MISMATCH'
  | 'AI_FORBIDDEN'
  | 'CLOSURE_NOT_ALLOWED_FROM_STATE'
  | 'CLOSURE_EVIDENCE_REQUIRED'
  | 'CLOSURE_EVIDENCE_TYPE_INVALID'
  | 'EXIT_NOT_ALLOWED_FROM_STATE'
  | 'EXIT_JUSTIFICATION_REQUIRED'
  | 'EXIT_OUTREACH_PROTOCOL_NOT_EXHAUSTED'
  | 'UNKNOWN_STATE';

export class MachineError extends Error {
  constructor(
    public readonly code: MachineErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'MachineError';
  }
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: MachineError };

export interface ApplyOutcome {
  snapshot: CaseSnapshot;
  events: CaseEvent[];
}
