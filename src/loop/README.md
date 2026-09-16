# src/loop/ — the chapter loop

One pi session per chapter (AGENTS.md loop protocol). Steps execute over
files; every LLM call goes through `src/llm.ts` and lands in `calls.db`
tagged with `chapter` + `sessionId`.

## CLI

```sh
bun src/loop/run.ts <novelDirOrName> <chapterN> [--dry] [--force-review]
                    [--steps plan,draft,review,fix,dispose] [--session <id>]
```

- `novelDirOrName` — a path to a novel dir or a name under `novels/`.
- `--dry` — plan/draft read existing files; review runs through the real
  LLM path with `LLM_OFFLINE=1` + `LLM_OFFLINE_RESPONSE=<review.json>`;
  fix is skipped. No live LLM.
- `--force-review` — proceed past a hard deterministic-gate failure.
- `--steps` — subset. `--session` — stable session id (idempotent LESSONS).

## Steps

| # | Step | Module | Input → Output |
| --- | --- | --- | --- |
| 1 | plan | `planStep` | canon+seed+state+LESSONS+prev feedback → `plan/chNN.yaml` (planner contract, `prompts/planner-contract.md`) |
| 2 | draft | `draftStep` | plan + canon + writer brief (`prompts/writer-brief.md` assembly) → scene-by-scene → `chapters/chNN.md`; deterministic gate runs after |
| 3 | gate | `runDeterministicGate` | validation + integrity + quality (blockers / high-severity) → stop unless `--force-review` |
| 4 | review | `reviewStep` | one merged judge (`prompts/reviewer-rubric.md` + `reviewer/context-spec.md`) → `reviews/chNN.review.json` (zod-validated) |
| 5 | fix | `fixStep` | flagged scenes only, bounded passes, re-gate each pass |
| 6 | dispose | `disposeStep` | L121 provisional classifications → `feedback/chNN-review.md`; LESSONS.md append (above marker); `state.md` current_chapter |

## Dry-run gate (phase 3)

```sh
LLM_OFFLINE=1 LLM_OFFLINE_RESPONSE=$PWD/tests/fixtures/loop-dry/reviews/ch01.review.json \
  bun src/loop/run.ts tests/fixtures/loop-dry 1 --dry
```

Artifacts produced: review json (real call path, canned content), feedback
md, LESSONS entry, state.md update, `llm_calls` row per step call.

## Files-first bindings (no DB, no embeddings)

| Old (harness) | New |
| --- | --- |
| `getChapterOutline` | `plan/chNN.yaml` (`novel.ts:readPlan`) |
| canon/world/facts | `canon/*.md` slices; facts parsed factId-tagged (`context.ts:parseFacts`) |
| character states | plan `character_state_changes` + `state.md` |
| retrieval/embeddings | dropped — exact-match reference resolver only |

## Cost/quality join

After each chapter, use `bun run session-summary --session <id>` for cost and
latency telemetry. Review outcomes remain Git-versioned files; correlate them
with the `session_id` and chapter tags recorded on each `llm_calls` row.
