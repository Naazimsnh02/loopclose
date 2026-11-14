# Model card — <feature>

| Field | Value |
|---|---|
| Feature | Navigator / Summariser / Risk / Grader |
| Model(s) | e.g. `claude-sonnet-5-5` (version pinned in env) |
| Purpose | One sentence |
| Users | Who sees the output |
| Inputs | Exactly what data is sent (structured fields; never raw channel text for the summariser) |
| Outputs | Draft / proposal / score; never a case closure or owner assignment |
| Human oversight | Who approves; what happens on rejection |
| Boundaries enforced by code | Tools available; state machine `aiPolicy`; grader gates |
| Evaluation | Golden-set pass rate, red-team block rate, faithfulness, calibration (link eval-report) |
| Known failure modes | List honestly |
| Languages | ar / en / ur / hi — review method and reviewers |
| Risk classification | Per DoH RAI Standard mapping |
| Kill-switch | Admin toggle + env var; degraded behaviour |
| Monitoring | Metrics watched and thresholds |
| Limitations | Synthetic-data caveats etc. |
