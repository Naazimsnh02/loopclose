import { scoreWithModel, scoreWithRules, type RiskModelJson } from './risk.service';

describe('risk scoring', () => {
  it('rules fallback flags red with top-3 reasons', () => {
    const r = scoreWithRules({ hours_since_notification_no_ack: 72, channel_failures: 2, prior_no_shows: 1, transport_barrier: 1 });
    expect(r.tier).toBe('red');
    expect(r.mode).toBe('rules');
    expect(r.reasons).toHaveLength(3);
  });

  it('model scoring applies scaler + coefficients and explains positive contributions', () => {
    const m: RiskModelJson = {
      version: 'test', trainedOn: 'synthetic', features: ['prior_no_shows', 'transport_barrier'], intercept: -2,
      coefficients: { prior_no_shows: 1.5, transport_barrier: 1.0 },
      scaler: { prior_no_shows: { mean: 0, scale: 1 }, transport_barrier: { mean: 0, scale: 1 } },
      thresholds: { amber: 0.3, red: 0.6 }, limitation: 'synthetic',
    };
    const low = scoreWithModel(m, { prior_no_shows: 0, transport_barrier: 0 });
    const high = scoreWithModel(m, { prior_no_shows: 2, transport_barrier: 1 });
    expect(low.tier).toBe('green');
    expect(high.tier).toBe('red');
    expect(high.reasons[0]?.feature).toBe('prior_no_shows');
  });
});
