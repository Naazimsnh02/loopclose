/**
 * Typed client for the LoopClose API. Token lives in sessionStorage (demo auth, E2.5); production
 * swaps this for an IdP session cookie without touching callers.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'lc_token';
const USER_KEY = 'lc_user';

export interface AuthUser {
  id: string;
  role: string;
  organizationId: string;
  displayName: string;
}

export const session = {
  token: (): string | null => (typeof window === 'undefined' ? null : sessionStorage.getItem(TOKEN_KEY)),
  user: (): AuthUser | null => {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  },
  set(token: string, user: AuthUser) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: { message?: string | string[]; code?: string; details?: unknown } | null,
  ) {
    super(ApiError.describe(status, body));
  }
  static describe(status: number, body: ApiError['body']) {
    const m = body?.message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
    return status === 401 ? 'Please sign in again' : status === 403 ? 'You are not allowed to do that' : `Request failed (${status})`;
  }
  get code() {
    return this.body?.code;
  }
}

export async function api<T>(path: string, init?: Omit<RequestInit, 'body'> & { json?: unknown }): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...((init?.headers as Record<string, string>) ?? {}) };
  const t = session.token();
  if (t) headers.Authorization = `Bearer ${t}`;
  let body: BodyInit | undefined;
  if (init?.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers, body, cache: 'no-store' });
  if (res.status === 401 && typeof window !== 'undefined') {
    session.clear();
    window.dispatchEvent(new Event('lc:unauthorized'));
  }
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---- Domain types (mirror the API's Prisma shapes we actually render) ----

export type Tier = 'routine' | 'priority' | 'urgent';
export type WorklistTab = 'overdue' | 'unassigned' | 'rejected' | 'stalled' | 'at_risk' | 'all';

export interface CaseRow {
  id: string;
  programmeId: string;
  resultId: string;
  patientId: string;
  state: string;
  tier: Tier;
  ownerId: string | null;
  ownerRole: string | null;
  ownerOrgId: string | null;
  version: number;
  createdAt: string;
  enteredStateAt: string;
  slaDeadlineAt: string | null;
  slaWarnAt: string | null;
  stalled: boolean;
  noShowCount: number;
  referralDeclineCount: number;
  riskTier: 'green' | 'amber' | 'red' | null;
  riskScore: number | null;
  riskReasons: unknown;
  closedAt: string | null;
  fhirTaskId: string | null;
  patient: { givenName: string; familyName: string; preferredLocale: string };
  owner: { displayName: string; role: string } | null;
}

export interface CaseDetail extends Omit<CaseRow, 'patient' | 'owner'> {
  patient: { id: string; fhirId: string; givenName: string; familyName: string; birthDate: string; sex: string; nationality: string | null; preferredLocale: string; phone: string | null; email: string | null; distanceKm: number | null; transportBarrier: boolean; priorNoShows: number };
  result: { id: string; externalId: string; loincCode: string; valueText: string; flags: string[]; issuedAt: string; receivedAt: string; fhirReportId: string | null };
  owner: { id: string; displayName: string; role: string; organizationId: string } | null;
  evidence: Array<{ id: string; type: string; reference: string; recordedBy: string; recordedAt: string }>;
  referrals: Array<{ id: string; status: string; recipientOrgId: string; createdAt: string }>;
  appointments: Array<{ id: string; status: string; scheduledAt: string }>;
  escalations: Array<{ id: string; ruleId: string; reason: string; priority: string; suggestedAction: string | null; status: string; targetRole: string; createdAt: string }>;
  proposals: Array<{ id: string; kind: string; feature: string; status: string; createdAt: string; payload: unknown }>;
}

export interface CaseEvent {
  id: string;
  caseId: string;
  sequence: number;
  type: string;
  actorKind: 'human' | 'system' | 'ai';
  actorId: string;
  actorRole: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
  fhirProvenanceId: string | null;
}

export interface Programme {
  id: string;
  name: string;
  version: string;
  initialState: string;
  terminalStates: string[];
  states: Array<{ id: string; stage: string; ownerRole: string | null; next: string[]; escalateTo?: string; sla?: Record<string, unknown> }>;
  closure: { fromStates: string[]; evidenceTypes: string[]; requireEvidenceOrHumanDecision: boolean };
  exits: Record<string, { fromStates: string[]; requireJustification?: boolean; minOutreachAttempts?: number }>;
  aiPolicy: { mayEnterStates: string[]; mayAssignOwners: boolean; mayClose: boolean };
}

export interface DirectoryUser {
  id: string;
  displayName: string;
  role: string;
  organizationId: string;
  organization: { name: string };
}

export interface DemoUser extends Omit<DirectoryUser, 'organization'> {
  email: string;
  locale: string;
  organization: { name: string; kind: string };
}

export interface Owner {
  id: string;
  role: string;
  organizationId?: string;
}

// ---- Endpoints ----

export const Auth = {
  demoUsers: () => api<DemoUser[]>('/api/auth/demo-users'),
  demoLogin: (email: string) => api<{ accessToken: string; user: AuthUser }>('/api/auth/demo-login', { method: 'POST', json: { email } }),
};

export const Cases = {
  list: (params: { tab?: WorklistTab; programmeId?: string; tier?: string; state?: string }) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    return api<CaseRow[]>(`/api/cases${qs ? `?${qs}` : ''}`);
  },
  summary: (params: { programmeId?: string; tier?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    return api<Record<WorklistTab, number>>(`/api/cases/summary${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => api<CaseDetail>(`/api/cases/${id}`),
  timeline: (id: string) => api<CaseEvent[]>(`/api/cases/${id}/timeline`),
  transition: (id: string, body: { to: string; reason?: string; owner?: Owner; loopReason?: 'no_show' | 'referral_declined' }) => api<unknown>(`/api/cases/${id}/transition`, { method: 'POST', json: body }),
  assign: (id: string, body: { owner: Owner; reason?: string }) => api<unknown>(`/api/cases/${id}/owner/assign`, { method: 'POST', json: body }),
  close: (id: string, body: { evidence?: Array<{ type: string; reference: string }>; decisionReason?: string }) => api<unknown>(`/api/cases/${id}/close`, { method: 'POST', json: body }),
  outreach: (id: string, body: { channel: 'web_chat' | 'whatsapp' | 'sms' | 'email' | 'phone'; outcome: 'delivered' | 'failed' | 'no_response' | 'reached'; at?: string }) => api<unknown>(`/api/cases/${id}/outreach`, { method: 'POST', json: body }),
  exit: (id: string, body: { kind: 'declined_by_patient' | 'lost_to_follow_up'; justification: string }) => api<unknown>(`/api/cases/${id}/exit`, { method: 'POST', json: body }),
};

export const Programmes = {
  list: () => api<Programme[]>('/api/programmes'),
};

export const Users = {
  list: (role?: string) => api<DirectoryUser[]>(`/api/users${role ? `?role=${encodeURIComponent(role)}` : ''}`),
};

export const Metrics = {
  funnel: (programmeId?: string) => api<Array<{ state: string; count: number }>>(`/api/metrics/funnel${programmeId ? `?programmeId=${programmeId}` : ''}`),
  ageing: () => api<Record<string, number>>('/api/metrics/open-results-ageing'),
};

export interface Escalation {
  id: string;
  caseId: string;
  ruleId: string;
  targetRole: string;
  targetOrgId: string | null;
  priority: 'routine' | 'priority' | 'urgent';
  reason: string;
  suggestedAction: string;
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: string;
  resolvedAt: string | null;
  resolution: string | null;
  case?: { id: string; state: string; tier: Tier; programmeId: string; patient?: { givenName: string; familyName: string } };
}

export const Escalations = {
  list: (params: { status?: string; targetRole?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    return api<Escalation[]>(`/api/escalations${qs ? `?${qs}` : ''}`);
  },
  resolve: (id: string, resolution: string) => api<unknown>(`/api/escalations/${id}/resolve`, { method: 'POST', json: { resolution } }),
};

// ---- Messaging & patient navigator (E5) ----

export type Locale = 'en' | 'ar' | 'ur' | 'hi';
export type Channel = 'web_chat' | 'whatsapp' | 'sms' | 'email' | 'phone';

export interface GraderVerdict {
  passed: boolean;
  checks: Array<{ id: string; passed: boolean; detail?: string }>;
  failedChecks: string[];
  mode: 'rules' | 'rules+llm';
  version: string;
}

export interface ChatMessage {
  id: string;
  caseId: string;
  direction: 'inbound' | 'outbound';
  channel: Channel;
  locale: string;
  templateId: string | null;
  text: string;
  graderVerdict: GraderVerdict | null;
  delivery: 'queued' | 'sent' | 'delivered' | 'failed' | 'read';
  sentAt: string | null;
  createdAt: string;
}

export type NavigatorIntent = 'emergency' | 'distress' | 'human' | 'teach_back_pass' | 'teach_back_fail' | 'faq' | 'question';

export interface NavigatorTurn {
  mode: 'rules' | 'disabled' | 'no_consent';
  intent: NavigatorIntent | null;
  matched: string[];
  inbound: ChatMessage;
  replies: ChatMessage[];
  escalationRuleId?: string;
  proposalId?: string;
}

export const Messaging = {
  history: (caseId: string) => api<ChatMessage[]>(`/api/messages/case/${caseId}`),
  send: (caseId: string, text: string, channel: Channel = 'web_chat') => api<NavigatorTurn>('/api/messages/inbound', { method: 'POST', json: { caseId, channel, text } }),
  startNavigator: (caseId: string) => api<{ blocked: boolean; replies?: ChatMessage[]; verdict?: GraderVerdict; fallback?: 'sms'; undelivered?: boolean }>(`/api/messages/navigator/${caseId}/start`, { method: 'POST' }),
  templates: () => api<Array<{ id: string; programme: string; stage: string; approval: { status: 'draft' | 'approved'; approvedBy: string | null; approvedAt: string | null; reviewers: Record<string, string> } }>>('/api/messages/templates'),
  navigatorScripts: () => api<Array<{ programme: string; version: string; approval: { status: 'draft' | 'approved'; approvedBy: string | null; approvedAt: string | null }; faqs: string[] }>>('/api/messages/navigator/scripts'),
};

export interface Proposal {
  id: string;
  caseId: string;
  kind: 'handoff_summary' | 'risk_assessment' | 'suggested_action' | 'patient_message' | 'acknowledgement';
  feature: string;
  model: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: string;
  decidedAt: string | null;
  case?: { id: string; state: string; programmeId: string; tier: Tier; patient: { givenName: string; familyName: string; preferredLocale: string } };
}

export const Proposals = {
  list: (params: { status?: string; caseId?: string; kind?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    return api<Proposal[]>(`/api/ai/proposals${qs ? `?${qs}` : ''}`);
  },
  decide: (id: string, decision: 'accepted' | 'rejected', extra: { ownerId?: string; note?: string } = {}) => api<Proposal>(`/api/ai/proposals/${id}/decide`, { method: 'POST', json: { decision, ...extra } }),
};

// ---- Admin / governance (E7.7, E12.3) ----

export interface AiFeature {
  name: 'navigator' | 'risk' | 'summariser';
  label: string;
  tier: string;
  offBehaviour: string;
  enabled: boolean;
  source: 'override' | 'environment';
  updatedAt: string | null;
  updatedBy: string | null;
  engine: string;
  proposals: { pending: number; accepted: number; rejected: number };
}

export interface AiActivity {
  messagesGraded: number;
  messagesBlocked: number;
  navigatorOutcomes: Record<string, number>;
  openEscalationsByRule: Record<string, number>;
  proposals: Array<{ kind: string; status: string; count: number }>;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorKind: 'human' | 'system' | 'ai';
  actorId: string;
  actorName: string;
  action: string;
  resource: string;
  resourceId: string | null;
  purpose: string | null;
  aiFeature: string | null;
  aiModel: string | null;
  outcome: string | null;
  metadata: Record<string, unknown> | null;
}

export const Admin = {
  features: () => api<AiFeature[]>('/api/admin/ai-features'),
  toggle: (name: string, enabled: boolean, reason?: string) => api<unknown>(`/api/admin/ai-features/${name}/toggle`, { method: 'POST', json: { enabled, ...(reason ? { reason } : {}) } }),
  activity: () => api<AiActivity>('/api/admin/ai-activity'),
  audit: (limit = 60) => api<AuditEntry[]>(`/api/admin/audit?limit=${limit}`),
  programmes: () => api<Programme[]>('/api/admin/programmes'),
  organizations: () => api<Array<{ id: string; name: string; kind: string; _count: { users: number; casesAsOwnerOrg: number } }>>('/api/admin/organizations'),
  users: () => api<Array<{ id: string; email: string; displayName: string; role: string; organizationId: string; organization: { name: string } }>>('/api/admin/users'),
};

export interface DemoState {
  offsetHours: number;
  now: string;
  demoCases: number;
  noShowCandidates: number;
  referralCandidates: number;
  overdue: number;
  failingPatients: Array<{ id: string; givenName: string; familyName: string }>;
}

export const Demo = {
  state: () => api<DemoState>('/api/demo/state'),
  setClock: (offsetHours: number) => api<{ offsetHours: number; now: string; newBreaches: number }>('/api/demo/clock', { method: 'POST', json: { offsetHours } }),
  pushResult: (input: { programmeId: 'colorectal-fit' | 'breast-birads'; locale: Locale; tier: 'routine' | 'priority' | 'urgent' }) =>
    api<{ caseId: string | null; tier?: string; patient: { id: string; name: string; locale: Locale } }>('/api/demo/result', { method: 'POST', json: input }),
  noShow: (caseId?: string) => api<{ caseId: string; noShowCount: number }>('/api/demo/no-show', { method: 'POST', json: caseId ? { caseId } : {} }),
  referralDecline: (caseId?: string) => api<{ caseId: string; referralId: string }>('/api/demo/referral-decline', { method: 'POST', json: caseId ? { caseId } : {} }),
  channelFailure: (patientId: string, fail: boolean) => api<{ failing: string[] }>('/api/demo/channel-failure', { method: 'POST', json: { patientId, fail } }),
  reset: () => api<{ removedDemoCases: number }>('/api/demo/reset', { method: 'POST' }),
};
