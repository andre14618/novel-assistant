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
bun run typecheck                 # tsc clean (phase-1 gate)
LLM_OFFLINE=1 bun run smoke       # dummy call → writes llm_calls row (no network)
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
tools/            smoke-call, session-summary, inspect-calls, export-from-old-db
novels/<name>/    seed.md, canon/, plan/, chapters/, feedback/, state.md
prompts/          phase 2 — carried-over prompt stack
checks/           phase 2 — deterministic checks
LESSONS.md        RL memory (L121 dispositions → prompt edits)
```

## Status

Phase 1 (scaffold + telemetry parity) — project state in
`docs/current-state.md`.
