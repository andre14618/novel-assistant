---
status: active
updated: 2026-09-16
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
- DeepSeek is the production default (flash/pro). A three-variable
  (`LLM_API_URL`, `LLM_MODEL`, `LLM_API_KEY`) OpenAI-compatible override exists
  for bounded local-rig validation; it is not a provider registry. No
  orchestrator, Postgres, or UI. Files + git + `calls.db` telemetry.

## Active surfaces

- `src/loop/` — run.ts CLI, steps.ts (six steps; `extractWriterProse`,
  `runDeterministicGate`, `provisionalClassification`), novel.ts, context.ts
  (planner/writer/reviewer renderers; writer brief renders the v1
  continuity contract per `prompts/writer-brief.md`), review-schema.ts.
- `src/llm.ts` — slim client; `LLM_OFFLINE_RESPONSE`; `callAgent` retries
  extract+zod failures once. Reviewer runs **thinking=false + JSON mode**
  (thinking + `response_format` conflict observed live: empty content at
  cap; config.json reviewer maxTokens 16384).
- AI-rig compatibility (2026-09-10): Qwen3.8 live structured smoke passed;
  sandboxed Rillgate draft+review produced 3,255 words, passed the native
  deterministic gate, and found 1 plan deviation + 3 fact contradictions.
  Production Rillgate files were not changed.
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
2. **Calendar facts + continuity anchors in brief** — delivered at
   contract/spec level: v1 continuity contract in `prompts/writer-brief.md`
   (one schedule fact per chapter; brief renders FACT CONTINUITY ANCHORS /
   CONTINUITY ANCHORS / READER INFO STATE; fail-closed validation; legacy
   plans readable with marker); loop-dry fixture plan on v1. LESSONS L-2
   integrated (contract/brief scope only — no live chapter re-run).
3. Seed import from old DB (on hold; archive down).

## Verification commands

- `bun test` · `bun run typecheck` · `LLM_OFFLINE=1 bun run smoke` ·
  `bun run check -- <chapter>.md <outline>.json` ·
  `bun run loop -- <novelDirOrName> <chapterN> [--dry]` ·
  `bun run session-summary [--session <id>]` · `bun run inspect [--chapter n]`.

## Pilot cost snapshot (session pilot-rillgate-ch1, final run)

draft $0.00612 · review $0.00424 · fix (failed passes) $0.00524 →
total $0.01560, 19 calls incl. earlier runs (writer 15 calls across 3
draft iterations — final run reused: 5 writer, 1 reviewer, 2 fixer).
