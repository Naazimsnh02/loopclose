'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bot, Check, MessageSquareHeart, X } from 'lucide-react';
import { Proposals, type CaseDetail } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';

const DECIDERS = new Set(['coordinator', 'coordinator_lead', 'phc_clinician', 'phc_lead', 'admin']);

/**
 * Pending AI proposals on a case (ADR-006). Shown at the top of the case so a person decides
 * before the SLA clock runs down. Only an `acknowledgement` changes the case, and only on acceptance.
 */
export function AiProposalsCard({ c, onDone }: { c: CaseDetail; onDone: () => Promise<void> | void }) {
  const { user } = useAuth();
  const [busy, setBusy] = React.useState<string | null>(null);
  const pending = c.proposals.filter((p) => p.status === 'pending' && p.kind !== 'risk_assessment');
  if (pending.length === 0) return null;
  const canDecide = !!user && DECIDERS.has(user.role);

  async function decide(id: string, decision: 'accepted' | 'rejected') {
    setBusy(id + decision);
    try {
      await Proposals.decide(id, decision);
      toast.success(decision === 'accepted' ? 'Confirmed. The case moved on with a named owner.' : 'Proposal rejected.');
      await onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-5 animate-in-up space-y-3">
      {pending.map((p) => {
        const tb = (p.payload as { teachBack?: { answer?: string; matched?: string[]; locale?: string } }).teachBack;
        const isAck = p.kind === 'acknowledgement';
        return (
          <div key={p.id} className="flex flex-wrap items-start gap-4 rounded-lg border border-ai/25 bg-ai-soft/50 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ai text-white">
              <Bot className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-semibold text-ink">{isAck ? 'Navigator: patient understood the next step' : `AI proposal: ${p.kind.replace(/_/g, ' ')}`}</span>
                <Badge tone="ai">Needs a person</Badge>
              </div>
              {isAck && (
                <p className="mt-1 text-[13px] leading-5 text-ink-2">
                  Teach-back passed. Confirming moves the case to <strong>Acknowledged</strong> and hands it to the primary-care clinician with the lightest load. The navigator cannot do this itself.
                </p>
              )}
              {tb?.answer && (
                <p dir="auto" className="mt-2 rounded-md border-s-2 border-ai/40 bg-white/70 px-3 py-1.5 text-start text-[13px] text-ink">
                  “{tb.answer}”
                </p>
              )}
              <Link href="/patient" className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ai hover:underline">
                <MessageSquareHeart className="h-3.5 w-3.5" /> View the conversation
              </Link>
            </div>
            {isAck && canDecide && (
              <div className="flex shrink-0 gap-2 self-center">
                <Button size="sm" variant="secondary" onClick={() => void decide(p.id, 'rejected')} loading={busy === p.id + 'rejected'} disabled={!!busy}>
                  <X className="h-3.5 w-3.5" /> Reject
                </Button>
                <Button size="sm" onClick={() => void decide(p.id, 'accepted')} loading={busy === p.id + 'accepted'} disabled={!!busy}>
                  <Check className="h-3.5 w-3.5" /> Confirm & hand off
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
