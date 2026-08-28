---
status: active
updated: 2026-08-27
role: canonical-current-truth
---

# Current State

Successor project to novel-harness (archived at
`~/Desktop/personal_projects/archives/novel-harness-main`). The migration
proposal is `docs/proposals/pi-chapter-loop-architecture-2026-05-18.md`.

## Posture

- **Phase 1 active**: scaffold + telemetry parity. Gate: `tsc` clean;
  `bun run smoke` writes a `llm_calls` row; `bun run session-summary` renders.
  Phase-1 gate is met once the smoke row persists and the summary prints.
- DeepSeek is the sole provider (two models: `deepseek-v4-flash`,
  `deepseek-v4-pro`). No multi-provider registry, no orchestrator, no Postgres.
- Files + git are the runtime. `calls.db` (SQLite) is telemetry only.

## Active surfaces

- `src/llm.ts` — slim DeepSeek client (retry/timeout, extractJSON, zod,
  cached-token cost accounting, guaranteed llm_calls row per call).
- `src/db.ts` — `bun:sqlite` schema: `llm_calls` (parity + `session_id`),
  `chapters`, `reviews`, `feedback`.
- `tools/` — `smoke-call.ts`, `session-summary.ts`, `inspect-calls.ts`,
  `export-from-old-db.ts` (archive help, needs `OLD_DB_URL`).

## Not yet built (phase 2+)

- Prompt extraction (writer-brief stack, merged reviewer rubric) from
  novel-harness keep-list.
- Deterministic checks (`checks/`), seed import, `novels/` first pilot novel
  (Rillgate ch1) — phases 2–4.

## Verification commands

- `bun run typecheck` — `tsc` clean (phase-1 gate).
- `LLM_OFFLINE=1 bun run smoke` — dummy call writes a row (no network).
- `bun run session-summary` — per-agent cost/cache summary renders.
- `bun run inspect --chapter 1` — drill into calls.

## Known gaps

- `export-from-old-db.ts` requires the old Postgres archive to be up — it is
  currently down; tool is for eventual one-time use.
- No reviews/feedback rows written yet (loop steps 5–6 land in phase 3).
