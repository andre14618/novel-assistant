# checks/ — deterministic checks

Ported (near-verbatim) from the novel-harness keep-list
(`docs/proposals/pi-chapter-loop-architecture-2026-05-18.md` §5); inputs are
files/strings only — no DB, no harness types:

| File | Old source | Surface |
| --- | --- | --- |
| `validation.ts` | `src/validation.ts` (`validateChapterDraft`) | POV presence, character mentions, word-count advisory, beat-keyword coverage, first-person/dialogue heuristics |
| `integrity.ts` | `src/lint/integrity.ts` | fused-boundary, camel-fusion, duplicate-sentence/fragment, quote-integrity; `validateLintFixIntegrity`; mechanical quote/duplicate repairs; `offsetToBeatIndex` |
| `quality.ts` | `src/lint/quality-detectors.ts` | `detectRepetition` (bigram/trigram window), `detectUnderlength`, `detectVoiceCollapse` (stub, LLM-backed by design) |
| `contract-shape.ts` | `src/agents/writer/scene-contract-shape.ts` | anchor/dramatic/endpoint/choice/budget shape metrics; anchor-only guard |
| `run.ts` | — | CLI gate: `bun checks/run.ts <chapter.md> [outline.json]` |

## Gate (phase-2 evidence)

The checks run on the saved old-harness chapter fixture AND match the old
modules' outputs on the same text (parity spot-checked on the fixture and on a
synthetic dirty text):

```sh
bun checks/run.ts tests/fixtures/cartographer-ch7.md tests/fixtures/cartographer-ch7.outline.json
```

Fixture provenance: `output/source-portable-authoring-cartographer-ch6-10-laterepair-1779060348-production-path-drafting-brief-authoring-bible-v1/chapter-7.md`
(cartographer novel ch7, drafted through the old production path with
authoring-bible v1 — 3609 words, old-harness clean).

Result: validation 0 blockers / 0 warnings, integrity 0 issues, quality 1 low
repetition ("as though" ×3 bigram) — identical findings to the old modules.
Repairs available: quote=0, duplicate=0 on the clean fixture.

## Wiring plan (phase 3)

- Pre-draft: `contract-shape.ts` guards planner output (no anchor-only scenes).
- Post-draft: `validation.ts` (drafting mode) + `integrity.ts` →
  `quality.ts` before the LLM review; `run.ts` exit code feeds the loop's
  fix-or-proceed decision. `validateLintFixIntegrity` guards any mechanical
  repair application (fixer may not introduce new artifacts).
