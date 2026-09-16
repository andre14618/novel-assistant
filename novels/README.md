# novels/

One directory per novel. Shape (from proposal §5):

```
novels/<name>/
  seed.md          # story ask, genre lane
  style.md         # optional per-novel genre/tone file (genre lane, register,
                   #   cadence, voice properties); renders as the STYLE: section
                   #   of the writer brief (writer-brief.md step 4). Absent → no
                   #   section. Author from prompts/writer/style-primer-salvatore.md.
  canon/           # world bible, characters, threads (files)
  plan/            # chNN.yaml — scene contracts, horizon = 1 chapter
  chapters/        # chNN.md — prose is the artifact
  feedback/        # chNN-review.md — L121 dispositions
  state.md         # current chapter, open threads, next plan notes
```

`style.md` is optional. When present, the novel loader reads it and the writer
briefing renders it verbatim as a `STYLE:` block for every scene of a chapter
(step 4 in `prompts/writer-brief.md`), so generated prose follows the tone of
the story being written without manual prompt pasting. When absent the brief is
unchanged (no section, no fallback to the era primer).

No pilot novel is imported yet. Phase 4 imports Rillgate ch1 from the repaired
source in the archived harness (`rillgate-ch4-endpoint-hygiene-1778723371`
lineage) — see `docs/proposals/pi-chapter-loop-architecture-2026-05-18.md` §2.
