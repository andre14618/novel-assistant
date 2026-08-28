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

- **Phases 1–2 complete, gate-met:**
  - P1: scaffold + telemetry parity (`tsc` clean; smoke writes a row;
    session-summary renders).
  - P2: deterministic checks + prompt extraction. Evidence gate:
    `bun checks/run.ts tests/fixtures/cartographer-ch7.md
    tests/fixtures/cartographer-ch7.outline.json` → 0 blockers, 0 integrity
    issues, 1 low repetition; outputs match the old modules on the same text
    (parity spot-checked on clean + synthetic dirty text).
- DeepSeek is the sole provider (two models: `deepseek-v4-flash`,
  `deepseek-v4-pro`). No multi-provider registry, no orchestrator, no Postgres.
- Files + git are the runtime. `calls.db` (SQLite) is telemetry only.

## Active surfaces

- `src/llm.ts` — slim DeepSeek client (retry/timeout, extractJSON, zod,
  cached-token cost accounting, guaranteed llm_calls row per call).
- `src/db.ts` — `bun:sqlite` schema: `llm_calls` (parity + `session_id`),
  `chapters`, `reviews`, `feedback`.
- `checks/` — validation, integrity, quality, contract-shape (ported);
  `checks/run.ts` is the deterministic gate.
- `prompts/` — writer-brief assembly spec, merged reviewer rubric +
  context spec, planner contract, verbatim prompt texts, authoring-bible
  pack data (rillgate-contrast-v1, 21 rules).
- `tests/fixtures/` — saved old-harness chapter (cartographer ch7, 3609w)
  + reconstructed outline.
- `tools/` — smoke-call, session-summary, inspect-calls, export-from-old-db
  (archive help, needs `OLD_DB_URL`).

## Not yet built (phase 3+)

- The pi chapter-loop: brief assembly, merged-review call, fix +
  disposition steps wired over files (loop protocol in AGENTS.md; dry-run
  on fixtures before any LLM).
- `novels/` first pilot novel (Rillgate ch1 import; proposal §2 lineage
  `rillgate-ch4-endpoint-hygiene-1778723371`), seed import, reviews/feedback
  row writes.

## Verification commands

- `bun run typecheck` — `tsc` clean (covers src/, tools/, checks/).
- `LLM_OFFLINE=1 bun run smoke` — dummy call writes a row (no network).
- `bun run check -- <chapter>.md <outline>.json` — deterministic gate.
- `bun run session-summary` — per-agent cost/cache summary renders.
- `bun run inspect --chapter 1` — drill into calls.

## Known gaps

- `export-from-old-db.ts` requires the old Postgres archive to be up — it is
  currently down; tool is for eventual one-time use.
- Fixture outline is reconstructed from the chapter (the original plan JSON
  was not retained in the output dirs); it is faithful to the draft's content
  but not byte-identical to the old plan.
- No reviews/feedback rows written yet (loop steps 5–6 land in phase 3).
- Authoring-bible review-layer port deferred per proposal §8 open question.
