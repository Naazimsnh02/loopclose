/**
 * Demo-only controls (clock shift, scenario pushes, reset) need DEMO_MODE=true. In a production
 * build they also need DEMO_SANDBOX=true — an explicit second key for a hosted synthetic-data
 * sandbox, so a real deployment can never switch them on by setting one flag.
 */
export function demoControlsEnabled(): boolean {
  if (process.env.DEMO_MODE !== 'true') return false;
  return process.env.NODE_ENV !== 'production' || process.env.DEMO_SANDBOX === 'true';
}
