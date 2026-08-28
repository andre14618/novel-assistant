# L099: Traceability IDs (carried over)

**Status:** active · **Source:** novel-harness `docs/decisions/L099-writer-prompt-id-rendering.md` (2026-05-10)

Traceability IDs are mandatory infrastructure across state, DB, telemetry,
checker findings, proposal targets, eval artifacts, and audit logs. The narrow
ablation question was whether raw IDs should be visible in the prose-writer
prompt; mapper/checker/reviewer/plan-update/disambiguation prompts keep IDs.

Applied here:

- All plan items carry durable IDs (`scene_id`, `beat_id`, `obligation_id`,
  `fact_id`, planned-state item IDs) — see `prompts/planner-contract.md`.
- Writer prompt: `idRendering: "raw"` (default, IDs visible in brief) or
  `"suppress"` (Cluster-1 raw-ID lines hidden; source-portability arms).
- Reviewer/checker prompts: IDs always visible; judges copy IDs back into
  findings (`fact_id`, `planned_item_id`).
- Telemetry: `session_id`, `chapter` tags on every `llm_calls` row; trace-ID
  discipline covers `state.md`, `feedback/chNN-review.md`, `LESSONS.md`.

Adjusted-B1 observation (old repo): ID suppression interacts with cache
stability — keep the suppression set stable per session so the cached system
prefix does not churn.
