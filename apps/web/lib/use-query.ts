'use client';

import * as React from 'react';

interface QueryState<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  /** True on background refreshes after first load — keeps the UI stable, shows a subtle indicator. */
  refreshing: boolean;
  refetch: () => Promise<void>;
  /** Optimistically replace data (reverted by the next refetch if the server disagrees). */
  mutate: (updater: (prev: T | undefined) => T | undefined) => void;
}

/**
 * Small data hook: no cache library, but the ergonomics we need for a polished UI —
 * stale-while-refresh, optimistic mutate, polling, and aborted stale responses.
 */
export function useQuery<T>(key: string, fetcher: () => Promise<T>, opts: { enabled?: boolean; pollMs?: number } = {}): QueryState<T> {
  const { enabled = true, pollMs } = opts;
  const [data, setData] = React.useState<T | undefined>(undefined);
  const [error, setError] = React.useState<Error | null>(null);
  const [loading, setLoading] = React.useState(enabled);
  const [refreshing, setRefreshing] = React.useState(false);
  const fetcherRef = React.useRef(fetcher);
  fetcherRef.current = fetcher;
  const seq = React.useRef(0);

  const run = React.useCallback(async () => {
    const mine = ++seq.current;
    setRefreshing(true);
    try {
      const d = await fetcherRef.current();
      if (mine !== seq.current) return;
      setData(d);
      setError(null);
    } catch (e) {
      if (mine !== seq.current) return;
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (mine === seq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    void run();
  }, [key, enabled, run]);

  React.useEffect(() => {
    if (!enabled || !pollMs) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void run();
    }, pollMs);
    return () => clearInterval(id);
  }, [enabled, pollMs, run]);

  const mutate = React.useCallback((updater: (prev: T | undefined) => T | undefined) => setData((p) => updater(p)), []);

  return { data, error, loading, refreshing, refetch: run, mutate };
}
