# prompts/

Phase 2+ — carried over (adapted, not rewritten) from the old harness
keep-list (`docs/proposals/pi-chapter-loop-architecture-2026-05-18.md` §5):

- `writer-brief.md` — old `src/agents/writer/` stack: context, drafting-brief,
  beat-context, scene-contract-shape, character-context,
  source-availability-checker.
- `reviewer-rubric.md` — one merged judge replacing chapter-plan-checker +
  continuity-facts + continuity-state + functional-state + per-scene
  adherence-events; scene-indexed findings against plan adherence,
  continuity, planned-state grounding, event enactment.
- `planner-contract.md` — scene contracts with obligations + endpoints
  (L095/L110 shape), horizon = 1 chapter.
- Authoring-bible packs (`src/harness/authoring-bible*.ts`, L118/L119) — decide
  in phase 2 or defer until the base loop proves out (proposal §8 open question).

The L121 feedback taxonomy and trace-ID discipline (L099) are preserved and
documented here next to the prompts that use them.
