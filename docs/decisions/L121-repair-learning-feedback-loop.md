# L121: Repair Learning Feedback Loop (carried over)

**Status:** active · **Source:** novel-harness `docs/decisions/L121-repair-learning-feedback-loop.md` (2026-05-16)

Reviewed repair, adjudication, and eval-miss work must close with a harness
feedback disposition before handoff. The operator or agent classifies the
lesson, then either integrates the reusable behavior into production-path
harness logic or records why it is story-specific.

Classifications (used verbatim in `feedback/` files):

- **Source defect:** fix the plan/source through reviewed proposal paths, then
  add or tighten a diagnostic, readiness target, checker, selector, prompt, or
  test that would catch the same defect earlier.
- **Layer cluster:** when several source defects share a handoff layer, stop
  extending draft windows and adjust the upstream planning/source-contract layer
  before collecting more drafting evidence.
- **False positive or selector error:** reduce repair pressure by tightening
  selectors, applicability predicates, rubrics, allowlists, or reviewer prompts;
  add focused regression coverage.
- **Reviewer calibration:** update the review prompt, binary gate, rubric, or
  artifact shape so future adjudication separates evidence from inference.
- **Repair-layer defect:** improve the deterministic or LLM repair surface that
  caused the issue, keeping semantic/content changes in proposal/review paths.
- **Story-specific one-off:** document the lesson in the session evidence and
  do not hard-code it unless the same fingerprint repeats.

Closure obligation: every repair lane ends with a feedback-disposition note
(review disposition step 5 of the loop protocol in AGENTS.md) whose lesson
lands in `LESSONS.md` — as a prompt edit, check, or documented one-off. The
Git-versioned feedback file is the durable record; SQLite is reserved for
LLM-call telemetry.
