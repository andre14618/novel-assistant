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
prompts/                writer-brief.md, reviewer-rubric.md, planner-contract.md,
                        writer/, planner/, reviewer/, authoring-bible.packs.json
checks/                 deterministic: validation, integrity, quality, contract-shape
src/                    config.ts, db.ts, cost.ts, llm.ts (slim core)
tools/                  smoke-call, session-summary, inspect-calls, export-from-old-db
tests/fixtures/         saved old-harness chapter + outline (check gate)
calls.db                SQLite telemetry (gitignored, created on first run)
config.json             two DeepSeek models, per-agent params
LESSONS.md              RL memory: generalized lessons + prompt revisions
docs/                   current-state.md, decisions/ (L099, L121), proposals/
```

## Loop protocol (L121/trace-ID discipline)

One pi session per chapter, six steps. Keep trace IDs and the L121 feedback
taxonomy — they are the continuity contract with the old repo.

1. **Plan** — reads `canon/` + `feedback/` + `LESSONS.md` + `state.md`, writes
   `plan/chNN.yaml` (scene contracts per `prompts/planner-contract.md`;
   guard with `checks/contract-shape.ts` — no anchor-only scenes).
2. **Draft** — writer generates scene-by-scene from the writer-brief stack
   (`prompts/writer-brief.md` assembly spec) → `chapters/chNN.md`.
3. **Deterministic gate** — `bun checks/run.ts` (validation + integrity +
   quality) before any LLM review; `validateLintFixIntegrity` guards repairs.
4. **Review** — one merged judge call (`prompts/reviewer-rubric.md` +
   `reviewer/context-spec.md`): plan adherence, continuity, state grounding,
   event enactment → scene-indexed findings.
5. **Fix** — fixer rewrites only flagged scenes, bounded retries.
6. **Disposition** — `feedback/chNN-review.md` with the L121 five-way
   classification; reusable lessons append to `LESSONS.md` as small prompt edits.
7. **Update** `state.md`; the next session's context pack is `canon/` +
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

- **Phase 1 ✅** — scaffold + telemetry parity. Gate met: `tsc` clean;
  `bun run smoke` writes a row; `bun run session-summary` renders.
- **Phase 2 ✅** — prompts + deterministic checks extracted/adapted. Gate met:
  ported checks pass on the saved old chapter
  (`bun checks/run.ts tests/fixtures/cartographer-ch7.md …`) and match the old
  modules' outputs on the same text.
- **Phase 3 ✅** — the pi chapter-loop: `src/loop/` steps (plan → draft →
  deterministic gate → merged review → fix → disposition) over files.
  Gate met: `tests/fixtures/loop-dry` chapter runs end-to-end with
  `--dry` (no live LLM), artifacts + telemetry written, LESSONS/state
  updates idempotent per session.
- **Phase 4 (pilot) ✅ provisional** — Rillgate ch1 live: drafted, reviewed,
  disposition recorded; cost draft+review $0.0104 in-band with old;
  turnaround ≈2–3 min. Evidence: `docs/evidence/pilot-rillgate-ch1.md`.
  Fixer bounded-passes failed (repair-layer gap, LESSONS L-1) — chapter
  preserved, ch1 passes; ch2+ blocked on the fixer + calendar-facts gaps.
- **Phase 5** — iterate: scene-scoped fixer, calendar facts + continuity
  anchors into writer brief, then ch2–ch3 with feedback-per-chapter
  trending via `LESSONS.md`.

## Keep it slim

If a change needs Postgres, an orchestrator, a UI, or a multi-provider registry,
it does not belong here — stop and re-check the proposal's drop-list.

## Local AI resource preference

When using the local AI rig, favor complete, high-quality work with generous
context, output-token, retry, and elapsed-time budgets within the promoted
runtime contract. Parallelize genuinely independent analysis or implementation
when useful, but do not require parallelism or split a cohesive task merely to
use available capacity. Keep authority finite, preserve evidence gates, and
leave promotion to the operator.
