# checks/

Phase 2+ — deterministic checks ported from the old harness keep-list
(`docs/proposals/pi-chapter-loop-architecture-2026-05-18.md` §5):

- `integrity.ts` — old `src/lint/integrity.ts` (syntax/integrity prose repairs).
- `quality.ts` — old `src/lint/quality-detectors.ts`.
- `validation.ts` — old `src/phases/validation.ts` (POV, word count).

Gate for phase 2: these pass unchanged against a saved old-harness chapter
before being wired into the loop.
