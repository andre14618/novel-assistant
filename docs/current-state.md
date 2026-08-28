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

- **Phases 1–4 complete:**
  - P1 scaffold + telemetry parity; P2 checks + prompts (gates met).
  - P3 chapter loop dry-run gate met (`tests/fixtures/loop-dry`).
  - **P4 Rillgate ch1 pilot executed LIVE** — see
    `docs/evidence/pilot-rillgate-ch1.md`. Gate: chapter drafted (3183w),
    reviewed (merged judge caught 2 real deviations + 3 real fact
    contradictions), disposition recorded; draft+review cost $0.0104 (in
    the old per-chapter band $0.008–0.013), loop wall time ≈2–3 min.
    Provisional pass; fixer step failed both bounded passes (repair-layer
    gap, chapter preserved, LESSONS L-1).
- DeepSeek is the sole provider (flash/pro). No orchestrator, no Postgres,
  no UI. Files + git + `calls.db` telemetry.

## Active surfaces

- `src/loop/` — run.ts CLI, steps.ts (six steps; `extractWriterProse`,
  `runDeterministicGate`, `provisionalClassification`), novel.ts, context.ts
  (planner/writer/reviewer renderers — **writer-brief steps 9–10
  (continuity anchors, reader-info) not yet rendered** → pilot P0 gap),
  review-schema.ts.
- `src/llm.ts` — slim client; `LLM_OFFLINE_RESPONSE`; `callAgent` retries
  extract+zod failures once. Reviewer runs **thinking=false + JSON mode**
  (thinking + `response_format` conflict observed live: empty content at
  cap; config.json reviewer maxTokens 16384).
- `novels/rillgate/` — imported repaired-source lineage: seed, canon
  (characters/facts/factId rows), plan/ch01.yaml (5 scenes, plannerspace
  contract shape), chapters/ch01.md (pilot draft), reviews/, feedback/,
  state.md.
- `checks/`, `prompts/`, `tests/fixtures/` (incl. sameplan baseline),
  `tools/`, `docs/evidence/`.

## Known gaps (phase 5 backlog, in priority order)

1. **Scene-scoped fixer** — fixer replaces the whole chapter with a
   scene-generation system prompt; gate caught 6 blockers both passes.
   Build dedicated fixer prompt (flagged-excerpt revisions, character/POV
   binding, per-beat application) — LESSONS L-1.
2. **Calendar facts + continuity anchors in brief** — plan must pin one
   schedule fact; writer brief must render fact continuity anchors +
   reader-info state (writer-brief.md steps 9–10) — LESSONS L-2.
3. db-side `chapters`/`reviews`/`feedback` rows (loop writes files; joins
   for cost-per-quality land with ch2 or a writer step).
4. Seed import from old DB (on hold; archive down).

## Verification commands

- `bun run typecheck` · `LLM_OFFLINE=1 bun run smoke` ·
  `bun run check -- <chapter>.md <outline>.json` ·
  `bun run loop -- <novelDirOrName> <chapterN> [--dry]` ·
  `bun run session-summary [--session <id>]` · `bun run inspect [--chapter n]`.

## Pilot cost snapshot (session pilot-rillgate-ch1, final run)

draft $0.00612 · review $0.00424 · fix (failed passes) $0.00524 →
total $0.01560, 19 calls incl. earlier runs (writer 15 calls across 3
draft iterations — final run reused: 5 writer, 1 reviewer, 2 fixer).
