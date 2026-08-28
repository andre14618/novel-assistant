# AGENTS.md — Novel Assistant

Pi-driven, file-first, chapter-by-chapter authoring loop. DeepSeek is the sole
LLM driver. Runtime surface is tiny on purpose: this project replaces the
~97K-line `src/` of novel-harness with files + git + one SQLite telemetry file.
The architecture proposal is the reference: `docs/proposals/pi-chapter-loop-architecture-2026-05-18.md`.

## Context pack — read first, in order

1. `AGENTS.md` (this file)
2. `docs/current-state.md` — live truth: posture, gates, active project state
3. `docs/proposals/pi-chapter-loop-architecture-2026-05-18.md` — the migration
   spec (change packet, keep-list, drop-list, §6 telemetry preservation)
4. `README.md` only when setup or command context is needed

## Repository layout

```
novels/<name>/          seed.md, canon/, plan/, chapters/, feedback/, state.md
prompts/                writer-brief, reviewer rubric, planner contract (phase 2+)
checks/                 deterministic checks: integrity, grounding, POV, word count (phase 2+)
tools/                  llm client wrappers, session-summary, inspect-calls, export-from-old-db
src/                    config.ts, db.ts, cost.ts, llm.ts (slim core)
calls.db                SQLite telemetry (gitignored, created on first run)
config.json             two DeepSeek models, per-agent params
LESSONS.md              RL memory: generalized lessons + prompt revisions
docs/proposals/         the migration proposal (reference)
```

## Loop protocol (L121/trace-ID discipline)

One pi session per chapter, six steps. Keep trace IDs and the L121 feedback
taxonomy — they are the continuity contract with the old repo.

1. **Plan** — reads `canon/` + `feedback/` + `LESSONS.md` + `state.md`, writes
   `plan/chNN.yaml` (scene contracts: obligations + endpoints, L095/L110 shape).
2. **Draft** — writer generates scene-by-scene from the carried-over writer-brief
   prompt stack → `chapters/chNN.md`.
3. **Review** — one merged judge call (plan adherence, continuity, state
   grounding, event enactment) → scene-indexed findings.
4. **Fix** — fixer rewrites only flagged scenes, bounded retries.
5. **Disposition** — `feedback/chNN-review.md` with the L121 five-way
   classification; reusable lessons append to `LESSONS.md` as small prompt edits.
6. **Update** `state.md`; the next session's context pack is `canon/` +
   `feedback/` + `LESSONS.md`.

## Telemetry discipline

- Every LLM call goes through `src/llm.ts` — never call the API directly.
- One row per call in `llm_calls` (guaranteed, success or failure) + console
  `[LLM]` cost line with `[cache:n]` suffix. Stable system-prefix-per-agent
  hygiene (L120 discipline) protects cache hits — do not shuffle prefixes.
- Per-chapter cost attribution: tag calls with `chapter` and `sessionId`.
- `bun run session-summary` after a chapter session; cost joins review outcomes.

## Doc discipline

- `docs/current-state.md` is live truth; keep it near 60 lines.
- Detailed decisions go in `docs/decisions/LNNN-short-slug.md`.
- Do not resurrect old-repo docs; port only what the proposal keep-list names.

## Git workflow

- Work directly on `main` by default. Coherent atomic commits; clean tree
  before handing off.
- `calls.db`, `node_modules/`, `.env` are gitignored — never commit them.

## Change intent

Before non-trivial implementation, surface the change packet: surface, exact
change, expected benefit, downstream projection, evidence gate. If unclear,
keep it diagnostic/docs-only or stop for user judgment.

## Phase gates (from the proposal §7)

- **Phase 1 (active)**: layout, AGENTS.md, slim `llm.ts`, full-fidelity
  `llm_calls` schema, `config.json`, seed import/export script.
  Gate: `tsc` clean; `bun run smoke` writes a row; `bun run session-summary` renders.
- **Phase 2**: extract prompts + deterministic checks from novel-harness
  (keep-list: writer prompt stack, authoring-bible packs, integrity/quality
  detectors, POV/word-count checks) and adapt.
- **Phase 3**: the pi chapter-loop skill (plan → draft → review → fix →
  disposition), dry-run on files without LLM.
- **Phase 4**: pilot Rillgate ch1 from the repaired source; gate = chapter
  drafted, reviewed, disposition recorded; per-chapter cost ≤ old; loop time
  minutes-to-hours.
- **Phase 5**: iterate; feedback-per-chapter trending down via `LESSONS.md`.

## Keep it slim

If a change needs Postgres, an orchestrator, a UI, or a multi-provider registry,
it does not belong here — stop and re-check the proposal's drop-list.
