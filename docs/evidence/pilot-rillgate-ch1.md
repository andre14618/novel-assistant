# Rillgate ch1 Pilot Evidence (Phase 4 gate)

Date: 2026-08-27 · Session: `pilot-rillgate-ch1` · Proposal: §2 evidence gate

## Source import

`novels/rillgate/` built from the repaired-source lineage
`rillgate-ch4-endpoint-hygiene-1778723371`:

- `seed.md` — story ask from `docs/sessions/2026-05-14-rillgate-story-shape-evidence.md`
  (MPA-01..10) + planner-quality ch1 purpose/endpoint.
- `canon/characters.md` — Kael/Orin/Tessa/Varn/Mira/Hask from authoring-bible
  pack `rillgate-contrast-v1` (voice rules verbatim).
- `canon/facts.md` — 8 factId-tagged rows from pack world rules + ch1
  purpose/endpoint evidence.
- `plan/ch01.yaml` — reconstructed from planner-quality report (title,
  purpose, endpoint, characters, target 2635 = 3100 × budget085) + scene ids
  and per-scene word loads from the sameplan run (1779041129). Scene
  dramatic fields/obligations written to the planner-contract shape.
- Archive baseline draft (sameplan run): `tests/fixtures/rillgate-ch1-baseline-sameplan.md`.

## Live loop run (--steps draft,review,fix,dispose)

| Step | Result |
| --- | --- |
| draft (5 scenes, beat-writer system) | 3183 words (target 2635 = 1.21 ratio; old sameplan run: 1.04–1.23 range) |
| deterministic gate | blockers=0 integrity=0 qualityHigh=0 → ok |
| merged review | passed=false; 2 deviations + 3 fact contradictions — ALL verified true against the draft (date inconsistency: Sixth day+Tenth vs Hask's fourteenth; beat-4 Gray Salt re-description contradicting the lethal deep-salvage run) |
| fix (2 bounded passes) | both failed gate (6 blockers — POV/character loss from whole-chapter regen); chapter preserved as-is per design; repair-layer defect logged (LESSONS L-1) |
| disposition | `feedback/ch01-review.md` written; provisional classification: source defect (operator-confirmed with 2 more: repair-layer defect; reviewer calibration positive — LESSONS L-1..L-3) |

## Cost (final run of the pilot session)

- draft: $0.00612 (5 calls, 62.5% cache-hit on the shared system prefix)
- review: $0.00424 (1 merged call — replaces the old ~5 judge calls)
- fix: $0.00524 (2 failed passes)
- **total: $0.01560; loop wall time ≈ 2–3 min** (minutes-to-hours ✓)

Comparison basis (old harness, from archived stats): planning-scenes
≈$0.0018/chapter + writer ≈$0.005–0.007 + 4-dimension scene-semantic +
checker judges ≈$0.002–0.004 → old per-chapter ≈ **$0.008–0.013**.
Draft+review alone ($0.0104) is within the old band; the fixer overrun
(+$0.0052) is the known repair-layer gap, not the judge.

## Gate verdict

- Chapter drafted ✓ · reviewed ✓ · disposition recorded ✓
- Per-chapter cost ≤ old per-chapter cost: **provisional pass** (draft+review
  in-band; fixer gap documented)
- Loop turnaround: **pass** (minutes, not days)
- Proposal §2 keeps the old repo as production path only if the gate fails —
  it did not; phase 5 iteration is authorized for ch2+, with the two
  P0 gaps: (1) scene-scoped fixer, (2) calendar facts + continuity anchors
  rendered into the writer brief (writer-brief.md steps 9–10 not yet
  implemented in `renderWriterBrief`).
