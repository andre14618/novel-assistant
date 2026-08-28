---
status: proposal
date: 2026-05-18
role: architecture-revision
scope: runtime simplification, pi-harness workflow migration, chapter-scoped authoring loop, cost telemetry preservation
---

# Pi Chapter-Loop Architecture Proposal

This proposal answers one question: **how should Novel Harness revise its
architecture to become simpler, chapter-scoped, and pi-harness-native — while
keeping DeepSeek as the sole LLM driver and preserving the token/cost
telemetry built so far?**

## 1. Drivers

1. **Complexity is out of proportion to the loop.** The runtime does
   plan → write → check → retry across ~97K lines of `src/` (374 files),
   ~135K lines of `scripts/` (388 files), 414 docs, 27+ SQL migrations,
   ~40 db modules, a custom state machine, HTTP server, SSE, and React UI.
   `src/phases/drafting.ts` alone is 2,364 lines.
2. **The evidence loop is already what the operator wants to do — at the
   wrong granularity.** L121 defines the feedback-disposition loop, but it
   operates at book scale ("13 source-contract proposals", "14 repairs",
   repair-run-repeat). A chapter-scoped loop gives one RL iteration per
   chapter with clean attribution.
3. **Judge overusage is the cost and latency driver, not cache pricing.**
   DeepSeek cache hits remain cheap; the operator decision is to keep
   DeepSeek as the main driver. Judge consolidation is still worth doing
   because (a) cache hits do not cover misses or output tokens, (b)
   thinking-mode judge calls dominate wall-clock, and (c) L112/L114
   evidence shows judge noise drives retry churn and false blockers.
4. **Three agent harnesses coexist** (`.claude/`, `.opencode/`, `AGENTS.md`
   conventions). A pi-native workflow should leave exactly one.

## 2. Change packet (L087)

- **Phase/surface**: runtime orchestration, persistence, authoring-loop
  granularity. Writer/planner/reviewer prompt engineering and deterministic
  checks are *carried over*, not redesigned.
- **Exact change**: build a new sibling project (`novel-loop/`) as a
  pi-driven, file-first, chapter-by-chapter authoring loop backed by a
  minimal `bun:sqlite` telemetry store. Freeze this repository as the
  evidence archive and prompt library. No live coupling to the existing
  Postgres, orchestrator, or UI.
- **Expected benefit**: loop iteration unit drops from book to chapter;
  runtime surface drops by ~90% (delete orchestrator, db, UI, trace/SSE,
  replay/injection test infra); per-chapter cost attribution joins review
  outcomes for the first time; single agent-harness convention.
- **Downstream projection**: loses the React pipeline view, SSE token
  streaming, `pipeline_events` trace history, and cross-novel SQL cohort
  analysis. These are replaced by pi's own session UI (terminal), per-call
  console cost lines, a session-summary script, and SQLite queries. Trace
  IDs and the L121 feedback taxonomy are preserved.
- **Evidence gate**: pilot Rillgate chapter 1 from the repaired source
  (`rillgate-ch4-endpoint-hygiene-1778723371` lineage) end-to-end through
  the new loop. Gate = chapter drafted, reviewed, disposition recorded;
  per-chapter cost ≤ old per-chapter cost; loop turnaround measured in
  minutes-to-hours, not days. If the gate fails, the old repo remains the
  production path and this proposal is revised or parked.

## 3. Repository reality check

| Dimension | Size |
| --- | --- |
| `src/` | 97K lines, 374 files |
| `scripts/` | 135K lines, 388 files |
| Docs | 414 markdown files |
| DB | Postgres, 27+ migrations, 40+ modules |
| Runtime surfaces | state machine, HTTP server, SSE, React UI, ~100 route files |
| Active agents | ~18 invoked in `src/`; ~40 defined in `roles.ts` |

Multi-provider support is dead weight: `llm.ts` force-normalizes every
provider to DeepSeek (`normalizeProviderName`, `normalizeModelName`,
`normalizeToActiveModelPolicy`), while `models/registry.ts` catalogs 10
providers that can never be reached. This becomes a two-model DeepSeek
config.

Existing decisions that support this direction: L092/L095 (scene as unit),
L112 (paid semantic gates demoted), L114 (checker noise separation), L121
(feedback dispositions), L103/L104/L105 (book-scale load control holds).

## 4. Decision: fresh SQLite, no piggybacking

Do **not** reuse `novel_harness_orchestrator`:

- Its schema is coupled to the old runtime (`pipeline_events`, canon
  substrate, proposal envelopes, runs/experiments) and drags the 40-module
  `db/` layer along.
- It adds per-session operational overhead (LXC + SSH tunnel, currently
  down on 15432).
- Workspace defaults are `bun:sqlite`, no ORMs, files-first.

The new project uses one SQLite file, `calls.db`, with full-fidelity
telemetry (see §6) plus three small content tables:

```
llm_calls   — full parity with the old llm_calls columns + session_id
chapters    — novel, n, status, plan_ref, draft_path, word_count
reviews     — chapter, judge_version, findings_json, disposition, passed
feedback    — chapter, classification (L121), lesson, integrated_into
```

Everything else is files + git. One-time export script migrates any
content worth continuing (repaired sources, seeds, past dispositions) from
the old Postgres to JSON files; the old DB stays a read-only archive.

## 5. Proposed architecture

```
novel-loop/
  AGENTS.md                 # pi conventions: loop protocol, doc discipline
  novels/<name>/
    seed.md                 # story ask, style brief
    canon/                  # world bible, characters, threads (files)
    plan/                   # chNN.yaml — scene contracts, horizon = 1 chapter
    chapters/               # chNN.md — prose is the artifact
    feedback/               # chNN-review.md — L121 dispositions
    state.md                # current chapter, open threads, next plan notes
  prompts/                  # writer-brief, chapter-reviewer rubric, planner contract
  checks/                   # deterministic: integrity, entity grounding, POV, word count
  tools/                    # llm.ts, session-summary, inspect-calls, export-from-old-db
  LESSONS.md                # RL memory: generalized lessons + prompt revisions
  calls.db                  # sqlite telemetry
  config.json               # two DeepSeek models, per-agent params
```

### The per-chapter loop (one pi session per chapter)

1. **Plan** — planner agent reads `canon/` + `feedback/` + `LESSONS.md`
   + `state.md`, writes `plan/chNN.yaml` (scene contracts with obligations
   and endpoints; keeps the L095/L110 contract shape).
2. **Draft** — writer agent generates scene-by-scene using the carried-over
   writer-brief prompt stack (character capsules, authoring-bible packs,
   source-availability boundaries) → `chapters/chNN.md`.
3. **Review** — **one merged judge call** replaces five judge shapes
   (chapter-plan-checker, continuity-facts, continuity-state,
   functional-state-checker, per-scene adherence-events). Returns
   scene-indexed findings against one rubric: plan adherence, continuity,
   planned-state grounding, event enactment.
4. **Fix** — fixer agent rewrites only flagged scenes, bounded retries.
5. **Disposition** — reviewer closes the loop: writes
   `feedback/chNN-review.md` with the L121 five-way classification; reusable
   lessons append to `LESSONS.md` and become small prompt edits.
6. **Update** `state.md`; the next chapter session's context pack is
   `canon/` + `feedback/` + `LESSONS.md`.

### Keep-list (extracted from this repo, adapted, not rewritten)

- Writer prompt stack: `src/agents/writer/` — context, drafting-brief,
  beat-context, scene-contract-shape, character-context,
  source-availability-checker.
- Authoring-bible packs: `src/harness/authoring-bible*.ts` (L118/L119).
- Deterministic checks: `src/lint/integrity.ts`, `quality-detectors.ts`,
  `src/phases/validation.ts` (POV, word count).
- Reviewer rubric: merge `chapter-plan-checker/context.ts` +
  `continuity/check.ts` into one prompt.
- `llm.ts` core: extractJSON, retry/timeout, usage extraction,
  cached-token accounting, full logging guarantees.
- Seeds, repaired sources, past feedback dispositions (exported JSON).
- L121 feedback taxonomy and trace-ID discipline (L099).

### Drop-list

- `orchestrator/`, `db/`, `ui/`, `phases/` state machine, `trace/`,
  `events.ts`, `harness/` service layer, `debug/` injection,
  phase-parity replay, transport interceptor.
- `models/registry.ts` multi-provider catalog → 2-model DeepSeek config.
- ~90% of `scripts/` (one-off evidence harnesses), `finetune-data/`,
  W&B/Together fine-tune infra, `poc/scene-first-novella/`,
  structural-prior corpus machinery, `scripts/hallucination/` bulk.
- `.claude/` and `.opencode/` directories.

## 6. Token/cost visibility preservation

The visibility investment lives in the logging layer and SQL scripts, not
Postgres or the UI — so it ports almost intact:

| Original surface | New equivalent |
| --- | --- |
| `llm_calls` row per call (agent, chapter/attempt tags, prompt/completion/cached tokens, cost, latency, tps, retries, prompts, zod errors, request envelope) | Same table in SQLite + `session_id` column for "what did chapter N cost" queries |
| `getTokenCost` cached-token split | Same code, 2-model price table |
| `cost-summary.ts` (model/agent/phase stats) | Ported to SQLite SQL |
| LLM inspector | `bun tools/inspect-calls.ts --chapter 3 --agent reviewer` |
| Live SSE streaming / heartbeats / `pipeline_events` | **Dropped** — pi's terminal session UI is the live view; per-call `[LLM] tokens (cost) [cache:n]` console lines remain |
| React UI (studio, pipeline, config, models, experiments) | **Dropped** — files + `state.md` + terminal |
| Experiments page with cost lineage | Per-session summaries + `session_id` tagging for A/B arms |

New capability: `bun tools/session-summary.ts` prints per-agent calls,
cost, and cache-hit % at the end of each chapter session, and cost now
joins review outcomes (cost-per-quality signal for the RL loop).

Cache posture: automatic prefix caching stays; keep the stable
system-prefix-per-agent hygiene (L120 discipline) and `cached_tokens`
telemetry, but no further cache engineering. DeepSeek remains the sole
provider; judges shrink for latency/noise reasons, not cache price.

## 7. Phased plan

| Phase | Work | Gate |
| --- | --- | --- |
| 0 | Freeze this repo (already under `archives/`); approve this proposal | Proposal review |
| 1 | Scaffold `novel-loop/`: layout, AGENTS.md, slim `llm.ts`, full-fidelity `llm_calls` schema, `config.json`, seed import, export script | `tsc` clean; dummy call writes a row; `session-summary` renders |
| 2 | Extract prompts + deterministic checks (copy/adapt) | Deterministic checks pass on a saved old chapter |
| 3 | Build the pi chapter-loop skill (plan → draft → review → fix → disposition) | Dry-run on files without LLM |
| 4 | Pilot: Rillgate ch1 from repaired source | End-to-end chapter, disposition recorded, cost ≤ old per-chapter cost |
| 5 | Iterate: subsequent chapters; tune reviewer via `LESSONS.md` | Feedback-per-chapter trending down; loop time measured |

## 8. Risks and open questions

- **Reviewer consolidation risk.** One merged judge may be weaker per-domain
  than five narrow ones. Mitigation: pilot compares merged-reviewer findings
  against the old per-checker findings on the same chapter before adopting.
- **History loss.** Cross-novel cohort SQL disappears with the orchestrator.
  Accepted: the new loop's unit is a chapter, and feedback lives in files.
  Old DB remains queryable read-only.
- **Open**: whether to port the authoring-bible review layer in phase 2 or
  defer until the base loop proves out; whether `proposals/` and `planning_edit`
  surfaces are needed in the file-first flow at all (initial answer: no —
  review dispositions replace proposal envelopes).

## 9. Decision needed

Approve phase 0+1 (scaffold + telemetry parity) and the pilot gate in §2,
or revise scope and park. If approved, this proposal becomes the reference
for the new project's `AGENTS.md` and the old repo gets a pointer in
`docs/current-state.md` marking the successor project.
