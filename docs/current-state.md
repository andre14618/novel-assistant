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

- **Phases 1–3 complete, gate-met:**
  - P1: scaffold + telemetry parity (`tsc` clean; smoke writes a row;
    session-summary renders).
  - P2: deterministic checks + prompt extraction. Evidence gate:
    `bun checks/run.ts tests/fixtures/cartographer-ch7.md
    tests/fixtures/cartographer-ch7.outline.json` → 0 blockers, 0 integrity
    issues, 1 low repetition; outputs match the old modules on the same text.
  - P3: the chapter loop (`src/loop/`). Evidence gate:
    `LLM_OFFLINE=1 LLM_OFFLINE_RESPONSE=... bun src/loop/run.ts
    tests/fixtures/loop-dry 1 --dry` → plan/draft read, gate passes, merged
    review runs the real call path (canned), fix skips, disposition writes
    feedback + LESSONS (idempotent per session) + state.md; reviewer row in
    `llm_calls` with chapter=1 + session tag.
- DeepSeek is the sole provider (two models: `deepseek-v4-flash`,
  `deepseek-v4-pro`). No multi-provider registry, no orchestrator, no Postgres.
- Files + git are the runtime. `calls.db` (SQLite) is telemetry only.

## Active surfaces

- `src/loop/` — run.ts CLI + steps.ts (plan/draft/gate/review/fix/dispose),
  novel.ts (file access, yaml plans, state.md), context.ts (planner/writer/
  reviewer context renderers per prompts/ specs), review-schema.ts (zod).
- `src/llm.ts` — slim DeepSeek client; `LLM_OFFLINE_RESPONSE` override for
  canned review payloads (dry-run path).
- `src/db.ts` — `bun:sqlite` schema: `llm_calls` (parity + `session_id`),
  `chapters`, `reviews`, `feedback`.
- `checks/` + `prompts/` + `tests/fixtures/` — see AGENTS.md layout.
- `tools/` — smoke-call, session-summary, inspect-calls, export-from-old-db.

## Not yet built (phase 4+)

- Rillgate ch1 pilot: import the repaired source (proposal §2 lineage
  `rillgate-ch4-endpoint-hygiene-1778723371`) into `novels/rillgate/`,
  write real plan + canon, run the loop for real (needs DEEPSEEK_API_KEY).
  Gate: chapter drafted, reviewed, disposition recorded; per-chapter cost ≤
  old per-chapter cost; loop time minutes-to-hours.
- `chapters`/`reviews`/`feedback` table rows wired (loop currently writes
  files; db-side joins land with the pilot or a writer step).
- Seed import from old DB (export-from-old-db.ts when archive is up).

## Verification commands

- `bun run typecheck` — `tsc` clean (covers src/, tools/, checks/).
- `LLM_OFFLINE=1 bun run smoke` — dummy call writes a row (no network).
- `bun run check -- <chapter>.md <outline>.json` — deterministic gate.
- `bun run loop -- <novelDirOrName> <chapterN> [--dry]` — chapter loop.
- `bun run session-summary` / `inspect` — telemetry read-back.

## Known gaps

- Writer/draft path is untested live (only offline-canned review path ran).
- Fixer applies whole-chapter replacement on pass (not surgical scene swap)
  — flagged-scene-only prompt, but application granularity is chapter-level.
- Fixture outline reconstructed from the chapter (original plan JSON not in
  output dirs).
- Authoring-bible review layer deferred per proposal §8 open question.
