# Planner Contract — chapter plan (plan/chNN.yaml)

Horizon = 1 chapter. The planner agent reads `canon/` + `feedback/` +
`LESSONS.md` + `state.md` and writes one file per chapter. Scene contracts
keep the L095/L110 contract shape (obligations + endpoints); the proposal
drops proposal-envelope surfaces — dispositions in `feedback/` replace them.

Adapted from `src/agents/writer/scene-contract-shape.ts` (field inventory)
and the planner prompt stack (`prompts/planner/chapter-outline-system.md`,
`prompts/planner/plan-revision-system.md`).

## File shape

```yaml
chapter: 7
title: "..."                      # headline of the chapter's turn
pov: "Alory Vane"
setting: "..."                    # primary location
purpose: "..."                    # what this chapter is for (story ask)
target_words: 2000
characters_present: ["Alory Vane", "Elara Venn"]
scenes:
  - scene_id: "ch7-s1"
    beat_id: "b1"
    kind: "confrontation"          # beat kind (planning-scenes taxonomy)
    description: "..."            # creative brief, NOT a literal script
    characters: ["Alory Vane", "Elara Venn"]
    anchors:
      temporal: "evening, three days after the ford survey"
      place: "Guild tower room, Vellin"
    dramatic:
      goal: "Alory forces Elara to explain the discrepancy"
      opposition: "Elara's authority and the offer she controls"
      turning_point: "Elara names the degree of the Guild's knowledge"
      crisis_choice: "accept the sealed appointment or refuse"
      choice_alternatives: ["sign the offer", "walk out", "demand the journal"]
      outcome: "Alory refuses; Elara's mask stays on"
      consequence: "Elara marks Alory for interception"
      pov_personal_stake: "Alory's truth vs her survival"
      value_in: "justice for Therin"
      value_out: "isolation and pursuit"
    endpoint: "..."                # promised landing (must be hit)
    obligations:
      - text: "..."                # obliged event, enacted not just described
        obligation_id: "ch7-s1-o1"
    target_words: 400
facts_to_establish: []            # factId= IDs from canon/facts.md
knowledge_changes:
  - character: "Alory Vane"
    id: "kc-1"
    knowledge: "the Guild moved the boundary stone"
    source: "gains"
character_state_changes:
  - name: "Alory Vane"
    id: "cs-1"
    location: "leaves Vellin"
    emotional: "resolved, afraid"
    knows: ["the boundary stone was moved"]
    does_not_know: ["the Thornwood order"]
```

## Field inventory (from scene-contract-shape.ts)

- **Anchor fields** — `temporal`, `place` (scene must be grounded in time
  and place).
- **Dramatic fields** — `goal`, `opposition`, `turning_point`,
  `crisis_choice`, `choice_alternatives[]`, `outcome`, `consequence`,
  `pov_personal_stake`, `value_in`, `value_out`. Full dramatic shape =
  goal + opposition + turning_point + crisis_choice (≥2 alternatives) +
  endpoint (outcome + consequence) + stake + value in/out.
- **Endpoint fields** — `outcome` + `consequence` (the promised landing).
- **Budget field** — `target_words` (telemetry/rough size signal only; not a
  plan substitute).
- **Anchor-only scenes** (no dramatic fields) are a red flag: a beat with
  anchors but zero dramatic shape cannot carry obligations. The planner must
  not emit them for anything but connective tissue, and should mark them
  explicitly.

## Obligations + endpoint discipline (L095/L110)

- Every scene lists its obligations explicitly; the writer must ENACT each,
  and the reviewer's `event_enactment` dimension checks them.
- `endpoint` is the promise to the next scene/chapter: the draft must land
  it or the reviewer flags the missing endpoint as a deviation (merge of
  the old per-scene endpoint-landing check).
- Beat descriptions are inspiration, not scripts — do not over-specify
  dialogue or blocking.

## Scope discipline

- Horizon = 1 chapter. Future reveal terms are boundary-redacted from the
  current chapter's generation (source-availability boundary discipline).
- Plan revision (`prompts/planner/plan-revision-system.md`) applies when a
  chapter's review shows plan-level defects: revise the plan, then redraft —
  do not ship drafts that fail the plan contract.
