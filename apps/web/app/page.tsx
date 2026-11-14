'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const HOME: Record<string, string> = {
  coordinator: '/coordinator',
  coordinator_lead: '/coordinator',
  programme_manager: '/dashboard',
  admin: '/dashboard',
  on_call_clinician: '/coordinator',
  specialist_scheduler: '/scheduler',
  breast_clinic_scheduler: '/scheduler',
};

/** Role-aware landing: send each persona to the screen they actually work in. */
export default function Home() {
  const { user, ready } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (ready && user) router.replace(HOME[user.role] ?? '/clinician');
  }, [ready, user, router]);
  return <div className="min-h-[40vh]" aria-busy />;
}
