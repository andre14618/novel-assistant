# Decisions Index

Carried-over harness decisions that govern this project (one file per
decision, `docs/decisions/LNNN-short-slug.md`):

| ID | Status | Decision | File |
| --- | --- | --- | --- |
| L099 | active | Traceability IDs are mandatory infrastructure; writer prompt `idRendering` raw/suppress; judge/checker prompts keep IDs; session + chapter tags in telemetry. | `docs/decisions/L099-traceability-ids.md` |
| L121 | active | Repair/adjudication work closes with a feedback disposition (six-way classification: source defect, layer cluster, false positive/selector error, reviewer calibration, repair-layer defect, story-specific one-off); reusable lessons become prompt edits, checks, or documented one-offs. | `docs/decisions/L121-repair-learning-feedback-loop.md` |

Referenced by the proposal (see `docs/proposals/pi-chapter-loop-architecture-2026-05-18.md`):
L087 change packet · L092/L095 scene as unit · L099 trace IDs · L103–L105
book-scale load control · L106/L107 production-path integration · L108 checker
readiness · L110 contract shape · L112 paid semantic gates demoted ·
L114 checker noise separation · L118/L119 authoring bible · L120 cache
prefix hygiene · L121 feedback dispositions.

Flow: the loop's disposition step writes provisional classifications from
finding kinds; the operator confirms or amends them in
`feedback/chNN-review.md`, and `LESSONS.md` entries track integration
status. New decisions for this project get their own file + index row.
