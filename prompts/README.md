# prompts/ — carried-over prompt surfaces (phase 2)

Extracted from the novel-harness keep-list
(`docs/proposals/pi-chapter-loop-architecture-2026-05-18.md` §5) — adapted,
not rewritten. Sources copied verbatim where they are pure prompt text;
assembled/merged specs are new files describing how the loop uses them.

## Assembled specs

- `writer-brief.md` — assembly spec for the writer drafting brief (old
  `renderWriterDraftingBrief` render order) + files-first bindings table.
- `reviewer-rubric.md` — the ONE merged judge rubric replacing five old judge
  shapes (plan-adherence + continuity-facts + continuity-state +
  planned-state grounding + event-enactment), with FALSE-POSITIVE rules
  preserved.
- `planner-contract.md` — `plan/chNN.yaml` shape: scene contracts with
  obligations + endpoints (L095/L110), field inventory from
  `scene-contract-shape.ts`, horizon = 1 chapter.

## Prompt texts (copied verbatim from old repo)

- `prompts/writer/beat-writer-system.md` — beat writer system prompt
- `prompts/writer/prose-writer-system.md` — prose writer system prompt
- `prompts/writer/style-primer-salvatore.md` — Salvatore era style primer;
  the reference template for authoring per-novel `novels/<name>/style.md`
  files (which render into the brief as the `STYLE:` section)
- `prompts/writer/voice-shaping.md` — D1/D2/D3 voice-shaping fragments
  (extracted from `voice-shaping-prompts.ts`)
- `prompts/planner/chapter-outline-system.md` — chapter outline system prompt
- `prompts/planner/plan-revision-system.md` — plan revision system prompt
- `prompts/reviewer/plan-adherence-system.md`, `fact-check-system.md`,
  `state-check-system.md` — the three old judge system prompts feeding the
  merged rubric
- `prompts/reviewer/context-spec.md` — merged judge user-prompt builder spec

## Data

- `prompts/authoring-bible.packs.json` — exported authoring-bible packs
  (L118/L119; `rillgate-contrast-v1`, 21 rules), from
  `src/harness/authoring-bible-packs.ts`. Rendering into the brief per
  `writer-brief.md` steps 2/8.

## Open question (proposal §8)

Authoring-bible review-layer port is deferred: base loop (phases 3–4) comes
first; the pack JSON is the extracted artifact either way.

## L121 / L099

Feedback taxonomy (`docs/decisions/L121-repair-learning-feedback-loop.md`)
drives `feedback/chNN-review.md` dispositions; trace-ID discipline
(`docs/decisions/L099-traceability-ids.md`) governs `idRendering` and judge
ID copying.
