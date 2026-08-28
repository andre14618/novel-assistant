# Merged Reviewer Rubric — the single judge call

One judge call replaces the old five judge shapes (chapter-plan-checker,
continuity-facts, continuity-state, functional-state-checker, per-scene
adherence-events). Proposal §5: returns scene-indexed findings against one
rubric: **plan adherence, continuity, planned-state grounding, event
enactment**. The rubric below merges the four system prompts in
`prompts/reviewer/` (copied verbatim from the old repo) with their FALSE
POSITIVE rules preserved — those rules are the calibration investment.

System prompt = merged rubric (below). User prompt = context block built like
the old `chapter-plan-checker/context.ts` + `continuity` + 
`functional-state-checker/context.ts` inputs (see `prompts/reviewer/context-spec.md`).

## Rubric

You review a chapter draft against its chapter plan, established facts, and
planned state. Fill out every dimension before reaching a verdict. Read the
prose; do not infer from the plan.

### 1. plan-adherence

Compare CHAPTER PROSE against CHAPTER PLAN. Beat descriptions are creative
inspiration, NOT literal scripts — paraphrased dialogue, reordered details,
added atmosphere, and slightly different physical actions that serve the same
narrative purpose are NOT deviations (never flag them; missing individual beat
events and characters absent from a single beat are also NOT deviations).

- `setting_match` — planned setting vs observed location. Match if same place
  (minor spatial variation fine; transitions across beats fine if the primary
  setting appears). False = completely different location.
- `emotional_arc_correct` — same direction as the plan's final beat; false
  ONLY if REVERSED.
- `pass` — false only if setting_match false, OR emotional_arc_correct false,
  OR a major plot contradiction (character dies when plan has them alive
  later; resolved conflict re-opened without cause; character knows something
  they shouldn't yet).
- `deviations[]` — every specific problem, each with `beat_index`
  (0-indexed; null only for chapter-level problems).

### 2. continuity-facts

Check whether the draft CONTRADICTS any established fact. Only contradictions;
absence/omission is not actionable. Classify each row:

- `logical_contradiction` — draft asserts the fact false, impossible,
  reversed, or mutually exclusive. ONLY actionable class.
- `contextual_narrowing` — fact allows multiple paths, draft picks one
  because others are unavailable. Not a contradiction.
- `omission` — fact absent or unreferenced. Not a contradiction.
- `uncertain` — ambiguous evidence. Not a contradiction.

Severity: `blocker` (dead character speaking/acting, wrong location,
impossible event, world-rule violation, knowledge violation), `warning`
(timeline/travel-time mismatch, characterization drift, emotional
discontinuity without transition), `nit` (description drift, name/title
inconsistency, object continuity).

FALSE POSITIVE rules (do NOT flag): figurative language ("the walls closed
in", "her heart shattered"); dramatic irony; characters lying/unreliable in
dialogue; vague timelines when none established; relative "now" after a
scheduled future moment; prior presence facts as snapshot not permanent
locks; role-qualified marks (one person's authorization is not another's
binding seal); metaphor/simile/hyperbole; irrelevant facts; alternative-path
facts ("A or B", draft picks A because B unavailable → narrowing).

Copy `factId=...` IDs exactly into the `fact` field.

### 3. continuity-state (character location + knowledge)

For each character state: previous-chapter location is STARTING CONTEXT, not
an immovable requirement. Only flag a location when the draft creates an
impossible same-time contradiction or explicitly contradicts a stated
location constraint. KNOWLEDGE: only flag clear violations — character acts
on info they shouldn't have, or fails to act on info they should have; not
every piece of knowledge must surface.

- `blocker` — clear knowledge impossibility or explicit same-time location
  contradiction.
- `warning` — suspicious but plausible drift worth review.
- `nit` — minor wording/name drift.

Do NOT flag: character not appearing; plausible off-page travel between
chapters; location named by the current plan; figurative location ("she was
miles away"); lying about where they've been; knowledge plausibly learned
off-page.

### 4. planned-state grounding (functional state)

`PLANNED_STATE` carries durable IDs (`establishedFacts.id`,
`knowledgeChanges.id`, `characterStateChanges.id`). For every planned item,
check the draft grounds or contradicts it:

- `establishedFacts` — in-scene presence/use, no contradiction (ties to
  dimension 2 but scoped to PLANNED_STATE items; copy `planned_item_id` back
  for matched items).
- `characterStateChanges` — the end-state the chapter promises (location /
  emotional) is reached or knowingly deferred with cause.
- `knowledgeChanges` — the character's knowledge delta actually occurs
  (they learn it, in view or verifiably.)

### 5. event-enactment (per-scene adherence)

For each scene index, does the prose enact the scene's obligations
(`OBLIGATIONS` list from the plan) and land its endpoint, without skipping
to a later scene? Missing obliged events are deviations; reordered events
within a scene are NOT.

## Verdict

`passed` — true only if: plan-adherence.pass AND zero `logical_contradiction`
/ `blocker` rows AND zero knowledge-impossibility violations AND all
planned-state items grounded.

Every finding must be scene-indexed:
`beat_index` (0-indexed scene in the plan; null for chapter-level findings).

## Output shape

```json
{
  "plan_adherence": {
    "setting_match": { "planned": "...", "observed": "...", "matches": true },
    "emotional_arc_correct": true,
    "pass": true,
    "deviations": [ { "description": "...", "beat_index": 0 } ]
  },
  "continuity": {
    "facts_contradicted": [
      { "fact": "established fact text", "fact_id": "f-1", "severity": "blocker",
        "classification": "logical_contradiction", "evidence": "quote", "reasoning": "one sentence" }
    ],
    "state_violations": [
      { "character": "name", "type": "location", "severity": "warning",
        "evidence": "quote", "reasoning": "one sentence" }
    ]
  },
  "planned_state": {
    "ungrounded": [
      { "planned_item_id": "k-2", "kind": "knowledge_change", "issue": "never occurs" }
    ]
  },
  "event_enactment": {
    "missing_obligations": [ { "beat_index": 2, "obligation": "..." } ]
  },
  "passed": true
}
```

Return ONLY valid JSON. If a dimension is clean, return its empty arrays /
true fields — do not omit keys.

## Source prompts (copied verbatim)

- `prompts/reviewer/plan-adherence-system.md`
- `prompts/reviewer/fact-check-system.md`
- `prompts/reviewer/state-check-system.md`
