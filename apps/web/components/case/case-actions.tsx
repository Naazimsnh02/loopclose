'use client';

import * as React from 'react';
import { ArrowRight, Ban, CheckCircle2, PhoneCall, UserRoundPlus, UserRoundX } from 'lucide-react';
import { ApiError, Cases, Users, type CaseDetail, type DirectoryUser, type Programme } from '@/lib/api';
import { useAuth, roleLabel } from '@/lib/auth';
import { useQuery } from '@/lib/use-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { toast } from '@/components/ui/toaster';
import { StateBadge, stateLabel } from '@/components/domain';
import { cn, humanize } from '@/lib/utils';

type Kind = 'transition' | 'assign' | 'outreach' | 'close' | 'exit';

interface Props {
  c: CaseDetail;
  programme: Programme | undefined;
  onDone: () => Promise<void> | void;
}

const ERROR_HINT: Record<string, string> = {
  OWNER_REQUIRED: 'This state needs an owner. Pick who takes it next.',
  OWNER_ROLE_MISMATCH: 'That person does not hold the role this state requires.',
  CLOSURE_EVIDENCE_REQUIRED: 'Closure needs evidence or a documented human decision.',
  CLOSURE_EVIDENCE_TYPE_INVALID: 'That evidence type is not accepted for closure in this programme.',
  CLOSURE_NOT_ALLOWED_FROM_STATE: 'Cases can only be closed from the final clinical states.',
  EXIT_OUTREACH_PROTOCOL_NOT_EXHAUSTED: 'Lost-to-follow-up needs the full outreach protocol first: 3 attempts across 2 channels including a phone call.',
  EXIT_JUSTIFICATION_REQUIRED: 'A written justification is required.',
  INVALID_TRANSITION: 'That move is not allowed from the current state.',
  TERMINAL_STATE: 'This case is already closed.',
};

function describe(e: unknown): { title: string; description?: string } {
  if (e instanceof ApiError) {
    const code = e.code;
    if (code && ERROR_HINT[code]) return { title: humanize(code.toLowerCase()), description: ERROR_HINT[code] };
    return { title: e.status === 403 ? 'Not permitted for your role' : 'Request rejected', description: e.message };
  }
  return { title: 'Something went wrong', description: e instanceof Error ? e.message : undefined };
}

/** Action bar + dialogs for the case detail page. Every outcome is reported with a toast; machine error codes get plain-language hints. */
export function CaseActions({ c, programme, onDone }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = React.useState<Kind | null>(null);
  const stateDef = programme?.states.find((s) => s.id === c.state);
  const terminal = programme?.terminalStates.includes(c.state) ?? false;
  const nextStates = (stateDef?.next ?? []).filter((n) => !programme?.terminalStates.includes(n) || n === 'closed').filter((n) => n !== 'closed');
  const canClose = programme?.closure.fromStates.includes(c.state) ?? false;
  const canAssign = ['coordinator', 'coordinator_lead', 'phc_lead', 'specialist_lead', 'programme_manager'].includes(user?.role ?? '');
  const canExit = ['coordinator', 'coordinator_lead', 'phc_clinician', 'phc_lead', 'specialist', 'specialist_lead', 'breast_clinic'].includes(user?.role ?? '');

  if (terminal) return null;

  const close = () => setOpen(null);
  const done = async (msg: string, desc?: string) => {
    toast.success(msg, desc ? { description: desc } : undefined);
    close();
    await onDone();
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {nextStates.length > 0 && (
          <Button onClick={() => setOpen('transition')}>
            Advance <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        )}
        {canAssign && (
          <Button variant="secondary" onClick={() => setOpen('assign')}>
            <UserRoundPlus className="h-4 w-4" /> {c.owner ? 'Reassign' : 'Assign owner'}
          </Button>
        )}
        <Button variant="secondary" onClick={() => setOpen('outreach')}>
          <PhoneCall className="h-4 w-4" /> Log outreach
        </Button>
        {canClose && (
          <Button variant="soft" onClick={() => setOpen('close')}>
            <CheckCircle2 className="h-4 w-4" /> Close with evidence
          </Button>
        )}
        {canExit && (
          <Button variant="ghost" onClick={() => setOpen('exit')} className="text-ink-muted">
            <Ban className="h-4 w-4" /> Exit pathway
          </Button>
        )}
      </div>

      <Dialog open={open === 'transition'} onOpenChange={(o) => !o && close()}>
        {open === 'transition' && <TransitionDialog c={c} programme={programme} nextStates={nextStates} onDone={done} onError={(e) => toast.error(describe(e).title, { description: describe(e).description })} />}
      </Dialog>
      <Dialog open={open === 'assign'} onOpenChange={(o) => !o && close()}>
        {open === 'assign' && <AssignDialog c={c} requiredRole={stateDef?.ownerRole ?? null} onDone={done} onError={(e) => toast.error(describe(e).title, { description: describe(e).description })} />}
      </Dialog>
      <Dialog open={open === 'outreach'} onOpenChange={(o) => !o && close()}>
        {open === 'outreach' && <OutreachDialog c={c} onDone={done} onError={(e) => toast.error(describe(e).title, { description: describe(e).description })} />}
      </Dialog>
      <Dialog open={open === 'close'} onOpenChange={(o) => !o && close()}>
        {open === 'close' && <CloseDialog c={c} programme={programme} onDone={done} onError={(e) => toast.error(describe(e).title, { description: describe(e).description })} />}
      </Dialog>
      <Dialog open={open === 'exit'} onOpenChange={(o) => !o && close()}>
        {open === 'exit' && <ExitDialog c={c} programme={programme} onDone={done} onError={(e) => toast.error(describe(e).title, { description: describe(e).description })} />}
      </Dialog>
    </>
  );
}

type DialogProps = { c: CaseDetail; onDone: (msg: string, desc?: string) => Promise<void>; onError: (e: unknown) => void };

function useSubmit(onError: (e: unknown) => void) {
  const [busy, setBusy] = React.useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

/** Owner picker filtered to a role; shows role mismatch inline before the server has to say no. */
function OwnerPicker({ role, value, onChange, exclude }: { role: string | null; value: DirectoryUser | null; onChange: (u: DirectoryUser | null) => void; exclude?: string | null }) {
  const users = useQuery(`users:${role ?? 'all'}`, () => Users.list(role ?? undefined));
  const list = (users.data ?? []).filter((u) => u.id !== exclude);
  return (
    <div className="max-h-[260px] space-y-1 overflow-y-auto rounded-md border border-line p-1 scroll-thin">
      {users.loading && <div className="p-3 text-[13px] text-ink-muted">Loading people…</div>}
      {!users.loading && list.length === 0 && <div className="p-3 text-[13px] text-ink-muted">Nobody with the role “{roleLabel(role)}” is available.</div>}
      {list.map((u) => {
        const active = value?.id === u.id;
        return (
          <button
            type="button"
            key={u.id}
            onClick={() => onChange(active ? null : u)}
            className={cn('flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-start transition', active ? 'bg-brand-soft ring-1 ring-brand-ring' : 'hover:bg-surface-2')}
            aria-pressed={active}
          >
            <Avatar name={u.displayName} size="sm" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium text-ink">{u.displayName.replace(/\s*\(.*\)/, '')}</span>
              <span className="block truncate text-[11.5px] text-ink-muted">
                {roleLabel(u.role)} · {u.organization.name.replace(' (synthetic)', '')}
              </span>
            </span>
            {active && <CheckCircle2 className="h-4 w-4 text-brand" />}
          </button>
        );
      })}
    </div>
  );
}

function TransitionDialog({ c, programme, nextStates, onDone, onError }: DialogProps & { programme: Programme | undefined; nextStates: string[] }) {
  const [to, setTo] = React.useState(nextStates[0] ?? '');
  const [reason, setReason] = React.useState('');
  const [owner, setOwner] = React.useState<DirectoryUser | null>(null);
  const [loop, setLoop] = React.useState<'' | 'no_show' | 'referral_declined'>('');
  const { busy, run } = useSubmit(onError);
  const target = programme?.states.find((s) => s.id === to);
  const isLoop = to === c.state;
  const needsOwner = !!target?.ownerRole && target.ownerRole !== c.ownerRole;

  React.useEffect(() => {
    setOwner(null);
    setLoop(isLoop ? (c.state === 'referral_sent' ? 'referral_declined' : 'no_show') : '');
  }, [to, isLoop, c.state]);

  return (
    <DialogContent
      title="Advance the case"
      description={
        <>
          From <StateBadge state={c.state} className="mx-1 align-middle" /> to the next step in the pathway.
        </>
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => onError(new Error('cancel'))} className="hidden" />
          <Button
            loading={busy}
            disabled={!to || (needsOwner && !owner)}
            onClick={() =>
              run(async () => {
                await Cases.transition(c.id, {
                  to,
                  ...(reason.trim() ? { reason: reason.trim() } : {}),
                  ...(owner ? { owner: { id: owner.id, role: owner.role, organizationId: owner.organizationId } } : {}),
                  ...(isLoop && loop ? { loopReason: loop } : {}),
                });
                await onDone(isLoop ? `Recorded ${humanize(loop)}` : `Moved to ${stateLabel(to)}`, owner ? `Owner: ${owner.displayName}` : undefined);
              })
            }
          >
            {isLoop ? 'Record and stay' : `Move to ${to ? stateLabel(to) : '…'}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Next state">
          <div className="grid gap-2">
            {nextStates.map((s) => {
              const def = programme?.states.find((x) => x.id === s);
              const active = s === to;
              return (
                <button
                  type="button"
                  key={s}
                  onClick={() => setTo(s)}
                  className={cn('flex items-center justify-between rounded-md border px-3 py-2.5 text-start transition', active ? 'border-brand bg-brand-soft/60 ring-1 ring-brand-ring' : 'border-line hover:bg-surface-2')}
                  aria-pressed={active}
                >
                  <span>
                    <span className="block text-[13.5px] font-medium text-ink">{s === c.state ? `Stay in ${stateLabel(s)} (loop)` : stateLabel(s)}</span>
                    <span className="block text-[12px] text-ink-muted">{def?.ownerRole ? `Owned by ${roleLabel(def.ownerRole)}` : 'Terminal / no owner'}</span>
                  </span>
                  {active && <CheckCircle2 className="h-4 w-4 text-brand" />}
                </button>
              );
            })}
          </div>
        </Field>
        {isLoop && (
          <Field label="Why is the case looping?">
            <NativeSelect value={loop} onChange={(e) => setLoop(e.target.value as typeof loop)}>
              <option value="no_show">Patient did not attend (no-show)</option>
              <option value="referral_declined">Referral declined by recipient</option>
            </NativeSelect>
          </Field>
        )}
        {target?.ownerRole && !isLoop && (
          <Field label={`Owner for ${stateLabel(to)}`} hint={needsOwner ? `Required: the next state is owned by a ${roleLabel(target.ownerRole)}.` : 'Optional — the current owner carries over if left empty.'}>
            <OwnerPicker role={target.ownerRole} value={owner} onChange={setOwner} />
          </Field>
        )}
        <Field label="Reason / note" hint="Written to the audit trail and FHIR Provenance.">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Patient confirmed by phone; colonoscopy slot 3 Nov 09:30" />
        </Field>
      </div>
    </DialogContent>
  );
}

function AssignDialog({ c, requiredRole, onDone, onError }: DialogProps & { requiredRole: string | null }) {
  const [owner, setOwner] = React.useState<DirectoryUser | null>(null);
  const [reason, setReason] = React.useState('');
  const { busy, run } = useSubmit(onError);
  return (
    <DialogContent
      title={c.owner ? 'Reassign owner' : 'Assign an owner'}
      description={requiredRole ? `The current state (${stateLabel(c.state)}) is owned by a ${roleLabel(requiredRole)}.` : 'Pick who is accountable for the next step.'}
      footer={
        <Button
          loading={busy}
          disabled={!owner}
          onClick={() =>
            run(async () => {
              if (!owner) return;
              await Cases.assign(c.id, { owner: { id: owner.id, role: owner.role, organizationId: owner.organizationId }, ...(reason.trim() ? { reason: reason.trim() } : {}) });
              await onDone(`Assigned to ${owner.displayName.replace(/\s*\(.*\)/, '')}`);
            })
          }
        >
          <UserRoundPlus className="h-4 w-4" /> Assign
        </Button>
      }
    >
      <div className="space-y-4">
        <OwnerPicker role={requiredRole} value={owner} onChange={setOwner} exclude={c.ownerId} />
        <Field label="Reason (optional)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Covering annual leave" />
        </Field>
      </div>
    </DialogContent>
  );
}

function OutreachDialog({ c, onDone, onError }: DialogProps) {
  const [channel, setChannel] = React.useState<'phone' | 'sms' | 'whatsapp' | 'email' | 'web_chat'>('phone');
  const [outcome, setOutcome] = React.useState<'reached' | 'no_response' | 'delivered' | 'failed'>('no_response');
  const { busy, run } = useSubmit(onError);
  return (
    <DialogContent
      title="Log an outreach attempt"
      description={`Human attempts to reach ${c.patient.givenName}. Three attempts over two channels, including a phone call, are needed before lost-to-follow-up.`}
      size="sm"
      footer={
        <Button
          loading={busy}
          onClick={() =>
            run(async () => {
              await Cases.outreach(c.id, { channel, outcome });
              await onDone('Outreach recorded', `${humanize(channel)} · ${humanize(outcome)}`);
            })
          }
        >
          <PhoneCall className="h-4 w-4" /> Record
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Channel">
          <NativeSelect value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
            <option value="phone">Phone call</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="web_chat">Web chat</option>
          </NativeSelect>
        </Field>
        <Field label="Outcome">
          <NativeSelect value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
            <option value="reached">Reached the patient</option>
            <option value="no_response">No response</option>
            <option value="delivered">Delivered, awaiting reply</option>
            <option value="failed">Failed to deliver</option>
          </NativeSelect>
        </Field>
      </div>
    </DialogContent>
  );
}

function CloseDialog({ c, programme, onDone, onError }: DialogProps & { programme: Programme | undefined }) {
  const types = programme?.closure.evidenceTypes ?? [];
  const [mode, setMode] = React.useState<'evidence' | 'decision'>('evidence');
  const [type, setType] = React.useState(types[0] ?? '');
  const [reference, setReference] = React.useState('');
  const [decision, setDecision] = React.useState('');
  const { busy, run } = useSubmit(onError);
  const valid = mode === 'evidence' ? !!type && reference.trim().length > 2 : decision.trim().length > 10;
  return (
    <DialogContent
      title="Close the loop"
      description="Closure is evidence-gated. Attach the document that proves the outcome, or record a clinician's decision with a reason."
      footer={
        <Button
          loading={busy}
          disabled={!valid}
          onClick={() =>
            run(async () => {
              await Cases.close(c.id, mode === 'evidence' ? { evidence: [{ type, reference: reference.trim() }] } : { decisionReason: decision.trim() });
              await onDone('Case closed', mode === 'evidence' ? `${humanize(type)} attached` : 'Human decision recorded');
            })
          }
        >
          <CheckCircle2 className="h-4 w-4" /> Close case
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-surface-2 p-1">
          {(['evidence', 'decision'] as const).map((m) => (
            <button type="button" key={m} onClick={() => setMode(m)} className={cn('h-8 rounded-[5px] text-[13px] font-medium transition', mode === m ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink')} aria-pressed={mode === m}>
              {m === 'evidence' ? 'With evidence' : 'Human decision'}
            </button>
          ))}
        </div>
        {mode === 'evidence' ? (
          <>
            <Field label="Evidence type">
              <NativeSelect value={type} onChange={(e) => setType(e.target.value)}>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {humanize(t)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Reference" hint="Document id, FHIR reference or report number.">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. DocumentReference/colo-2026-00412" />
            </Field>
          </>
        ) : (
          <Field label="Decision and reason" hint="Recorded with your name and timestamp; visible to auditors.">
            <Textarea value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="e.g. Reviewed histology verbally with pathologist; benign polyp, no surveillance indicated." />
          </Field>
        )}
      </div>
    </DialogContent>
  );
}

function ExitDialog({ c, programme, onDone, onError }: DialogProps & { programme: Programme | undefined }) {
  const [kind, setKind] = React.useState<'declined_by_patient' | 'lost_to_follow_up'>('declined_by_patient');
  const [justification, setJustification] = React.useState('');
  const { busy, run } = useSubmit(onError);
  const ltf = programme?.exits.lost_to_follow_up;
  return (
    <DialogContent
      title="Exit the pathway"
      description="Exits are audited and reviewed by the programme. They are never silent."
      footer={
        <Button
          variant="danger"
          loading={busy}
          disabled={justification.trim().length < 10}
          onClick={() =>
            run(async () => {
              await Cases.exit(c.id, { kind, justification: justification.trim() });
              await onDone(`Exited: ${stateLabel(kind)}`);
            })
          }
        >
          <UserRoundX className="h-4 w-4" /> Confirm exit
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Exit type">
          <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="declined_by_patient">Declined by patient (informed refusal)</option>
            <option value="lost_to_follow_up">Lost to follow-up (outreach protocol exhausted)</option>
          </NativeSelect>
        </Field>
        {kind === 'lost_to_follow_up' && ltf && (
          <p className="rounded-md bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
            Requires at least {ltf.minOutreachAttempts} logged attempts across 2 channels including a phone call. Use “Log outreach” first if the protocol is incomplete.
          </p>
        )}
        <Field label="Justification" hint="Minimum 10 characters.">
          <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder={kind === 'declined_by_patient' ? 'e.g. Patient declined colonoscopy after discussion of risks; declined letter sent 24 Oct.' : 'e.g. 3 calls, 2 SMS, 1 WhatsApp over 14 days; GP informed.'} />
        </Field>
      </div>
    </DialogContent>
  );
}
