# ADR-008 — Single LLM choke point, model-agnostic, in-country deployable

**Status:** Accepted · 2026-10-24

## Decision
All model calls go through `LlmClient` (apps/api). Default models: `claude-sonnet-5-5` for Navigator/Summariser, `claude-haiku-5-5` for grading/classification. Model ids are env-configured per feature. The client audits every call, degrades gracefully (template-only / rules-only) when unavailable, and never logs raw prompts (hash only).

For pilots, the same interface can target an in-country hosted model endpoint (e.g. via Azure, UAE North) to satisfy data-residency requirements; the prototype uses synthetic data only.

## Consequences
+ Swappable vendor; auditable; kill-switchable.
− Prompt/tool definitions must stay provider-neutral where possible.
