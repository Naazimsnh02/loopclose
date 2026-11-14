# Limitations (submission section — keep numbered and current)

1. **Synthetic data only.** No real patients, no clinical validation. All impact figures are simulation outputs under cited/assumed parameters, not measured outcomes.
2. **Risk model has no predictive validity.** It is trained on synthetic data and demonstrates the pipeline and explainability only. A rules fallback governs the first 30 days of any pilot; retraining on pilot outcomes requires clinical sign-off.
3. **LLM output quality** in Arabic, Urdu and Hindi is reviewed on the template set and golden scenarios, not at scale. Free-text generation to patients remains gated behind the safety grader and human review.
4. **No live integrations** with Malaffi, EMRs, LIS, scheduling systems or WhatsApp in the prototype; adapters are designed and stub-tested. Malaffi's API specifics are unconfirmed.
5. **Not a medical device claim.** The platform tracks, communicates and coordinates; it does not interpret results or make clinical decisions.
6. **Evaluation scope.** Red-team and golden-set evaluations cover the scenarios we anticipated; novel failure modes may exist. Results, including failures, are reported in the eval report.
7. **Two programmes only** (colorectal FIT, breast BI-RADS) are configured; others (cervical, lung, non-cancer actionable results) are roadmap.
8. **Authentication** in the prototype is a demo JWT issuer with seeded role users; production requires an enterprise IdP and DoH-aligned access controls.
