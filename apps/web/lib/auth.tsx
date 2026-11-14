'use client';

import * as React from 'react';
import { Auth, session, type AuthUser } from './api';

interface AuthState {
  user: AuthUser | null;
  ready: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: () => void;
}

const Ctx = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setUser(session.user());
    setReady(true);
    const onUnauthorized = () => setUser(null);
    window.addEventListener('lc:unauthorized', onUnauthorized);
    return () => window.removeEventListener('lc:unauthorized', onUnauthorized);
  }, []);

  const signIn = React.useCallback(async (email: string) => {
    const res = await Auth.demoLogin(email);
    session.set(res.accessToken, res.user);
    setUser(res.user);
  }, []);

  const signOut = React.useCallback(() => {
    session.clear();
    setUser(null);
  }, []);

  const value = React.useMemo(() => ({ user, ready, signIn, signOut }), [user, ready, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = React.useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}

/** Human-friendly role labels, used in badges and the role switcher. */
export const ROLE_LABEL: Record<string, string> = {
  coordinator: 'Coordinator',
  coordinator_lead: 'Coordinator lead',
  programme_manager: 'Programme manager',
  phc_clinician: 'Primary care clinician',
  phc_lead: 'Primary care lead',
  specialist: 'Specialist',
  specialist_scheduler: 'Specialist scheduler',
  specialist_lead: 'Specialist lead',
  breast_radiologist: 'Breast radiologist',
  breast_clinic: 'Breast clinic specialist',
  breast_clinic_scheduler: 'Breast clinic scheduler',
  treating_clinician: 'Treating clinician',
  on_call_clinician: 'On-call clinician',
  radiology_lead: 'Radiology lead',
  breast_clinic_lead: 'Breast clinic lead',
  admin: 'Administrator',
};
export const roleLabel = (r: string | null | undefined) => (r ? (ROLE_LABEL[r] ?? r.replace(/_/g, ' ')) : '—');
