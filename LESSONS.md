# LESSONS.md — RL memory

Generalized review lessons accumulate here, one entry per lesson, and become
small prompt revisions in `prompts/`. This file is part of the next chapter
session's context pack (`canon/` + `feedback/` + `LESSONS.md`).

## Format

```
### L-<n>: <one-line lesson title>
- chapter: <novel> ch<n>
- observation: <what happened>
- cause: <why it happened>
- action: <prompt edit or process change>
- status: pending | integrated | superseded
```

## Entries

### L-1-te-ch1: fixer whole-chapter regen breaks POV — use scene-scoped fixer
- chapter: rillgate ch1
- observation: fixer (beat-writer system, whole-chapter output) produced drafts failing 6 gate blockers (POV/character names lost) across both bounded passes
- cause: repair-layer defect — fixer has no scene-scoped application; it regenerates the full chapter with a scene-generation system prompt
- classification: repair-layer defect
- action: build a dedicated fixer system prompt (targeted revisions of flagged scene excerpts only, character names/POV binding) and apply replacements per flagged beat; keep whole-chapter regen as last resort behind the deterministic gate
- status: pending

### L-2-source-defect-ch1: calendar anchors missing in plan — writer invented conflicting dates
- chapter: rillgate ch1
- observation: ch1 opens Sixth day + 4 days = Tenth, but Hask says the bell rings the fourteenth-day; reviewer caught as deviation + fact-6 contradiction
- cause: source defect — scene anchors.temporal existed but did not bind a single schedule; no calendar fact row pinned the sale date
- classification: source defect
- action: planner contract must emit one explicit schedule fact (factId) per chapter; scenes carry relative dates resolved against it; writer brief renders fact continuity anchors (writer-brief.md steps 9-10)
- status: integrated (scope: continuity contract + brief spec only — v1 contract agreed and documented in prompts/writer-brief.md, loop-dry fixture plan on v1; no live chapter result, rillgate ch1 artifacts unchanged)

### L-3-reviewer-calibration-ch1: merged judge caught both real defects — keep rubric
- chapter: rillgate ch1
- observation: single merged judge flagged the date inconsistency and the Gray-Salt re-description (beat 4) as deviations + logical_contradictions; both verified TRUE against draft text (no false positives)
- cause: positive — rubric FALSE-POSITIVE rules + scene-indexed output worked on a real chapter
- classification: reviewer calibration
- action: no rubric change; proceed with this judge shape for ch2; monitor false-positive rate
- status: integrated

<!-- New lessons append above this comment. -->
