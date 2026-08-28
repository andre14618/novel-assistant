# Reviewer context spec — merged judge user prompt

The merged judge (`prompts/reviewer-rubric.md`) consumes one context block
built from files. This spec merges the old context builders:
`chapter-plan-checker/context.ts`, `functional-state-checker/context.ts`,
`continuity/check.ts`, and `adherence-checker` beat envelopes.

## Evidence tiers

```
EVIDENCE_TIERS:
required: PLAN, PLANNED_STATE, CHAPTER_PROSE, ESTABLISHED_FACTS,
          END-OF-PREVIOUS-CHAPTER CHARACTER STATES.
supporting: beat descriptions and planned character lists identify the
            intended beat job.
inventory: none.
```

## Sections (in order)

1. **CHAPTER** — JSON: `chapterNumber`, `title`, `povCharacter`, `setting`,
   `purpose` (`plan/chNN.yaml` root).
2. **PLAN** — the chapter plan's scenes array verbatim (scene contracts with
   obligations/endpoints, per `prompts/planner-contract.md`).
3. **PLANNED_STATE** — JSON: `establishedFacts`, `characterStateChanges`,
   `knowledgeChanges` from the plan, with durable IDs kept verbatim so the
   judge can copy matched `planned_item_id` back.
4. **ESTABLISHED_FACTS** — `canon/facts.md` rows up to this chapter
   (`factId=...`, category, fact text), trimmed to facts the chapter can
   plausibly touch (scope bound; old repo retrieved "facts up to chapter").
5. **END-OF-PREVIOUS-CHAPTER STATE** — per character: `location`,
   `emotional`, `knows[]`, `does_not_know[]` (from `state.md` / previous
   chapter's planned `character_state_changes`).
6. **CHAPTER PROSE** — the draft as authored, verbatim, no section headers
   injected mid-text.
7. **CHAPTER PROSE BY BEAT** (only if the judge arm needs scene-indexed
   evidence for `event_enactment`): per scene index — `beat_id`, description,
   planned characters, prose slice. Prose slicing must not alter the text.

## Scene-indexing convention

`beat_index` = 0-indexed position in the plan's `scenes[]`. `null` only for
chapter-level findings (setting mismatch spanning the chapter, emotional arc
drift). This is the single finding-locator contract across all five rubric
dimensions.

## L099 trace-ID rendering

Judge-facing context keeps IDs (`factId=`, `planned_item_id`, scene/beat IDs)
always — the L099 ablation only ever touched the writer prompt. The judge
copies IDs back into findings so `inspect-calls` / `session-summary` joins
against `chapters`/`reviews` schema IDs.
