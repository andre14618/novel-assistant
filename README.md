# Novel Assistant

Pi-driven, file-first, chapter-by-chapter authoring loop — the successor to
novel-harness (archived). DeepSeek is the sole LLM driver; the runtime is
files + git + one SQLite telemetry file (`calls.db`).

See `docs/proposals/pi-chapter-loop-architecture-2026-05-18.md` (copied from
the harvest repo, 2026-05-18) for the full migration spec. `AGENTS.md` is the
agent context pack.

## Setup

```sh
bun install
cp .env.example .env   # set DEEPSEEK_API_KEY
```

## Commands

```sh
bun run typecheck                 # tsc clean (covers src/, tools/, checks/)
LLM_OFFLINE=1 bun run smoke       # dummy call → writes llm_calls row (no network)
bun run check -- <chapter>.md <outline>.json   # deterministic gate
bun run loop -- <novelDirOrName> <chapterN> [--dry]  # chapter loop
bun run session-summary           # per-agent calls, cost, cache-hit %
bun run session-summary --latest  # last session only
bun run inspect --chapter 1 --agent reviewer
bun run export-old --tables llm_calls,chapters   # needs OLD_DB_URL (archive)
```

## Layout

```
src/llm.ts        slim DeepSeek client: extractJSON, retry/timeout, cost, logging
src/db.ts         SQLite schema: llm_calls (parity + session_id), chapters, reviews, feedback
src/config.ts     config.json loader (two DeepSeek models, per-agent params)
src/cost.ts       getTokenCost: cached-rate math
src/loop/         chapter loop: plan → draft → gate → review → fix → disposition
tools/            smoke-call, session-summary, inspect-calls, export-from-old-db
checks/           validation, integrity, quality, contract-shape (ported) + run.ts
prompts/          writer-brief, reviewer-rubric, planner-contract, verbatim texts
novels/<name>/    seed.md, canon/, plan/, chapters/, feedback/, state.md
LESSONS.md        RL memory (L121 dispositions → prompt edits)
```

## Status

Phases 1–4 complete: scaffold + telemetry parity, checks + prompts
extracted (gate met on saved old chapter), chapter loop running (dry-run
gate met), and the **Rillgate ch1 pilot ran live** — drafted, reviewed
(merged judge caught 2 real defects, 0 false positives), disposition
recorded; draft+review $0.0104 (old band $0.008–0.013), ≈2–3 min wall
clock. Evidence: `docs/evidence/pilot-rillgate-ch1.md`. Phase 5 closes
 the fixer + calendar-anchor gaps before ch2. Project state in
`docs/current-state.md`.
