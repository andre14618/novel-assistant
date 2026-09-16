# Writer Drafting Brief — assembled template

The brief is assembled per scene (beat) at draft time. This file is the
assembly spec, adapted from `novel-harness/src/agents/writer/drafting-brief.ts`
(`renderWriterDraftingBrief` render order) to files-first inputs. The prompt
texts themselves live in `prompts/writer/` (copied verbatim, adapted in
phase 3).

## Assembly order (stable — cache-prefix discipline L120)

Sections are concatenated with `\n\n` in this order. Keep this order stable:
the system prefix is what DeepSeek caches.

1. **Scene execution floor** (when `mode` enables scene-turn floor)
   — `beat-writer-system.md` / `prose-writer-system.md` (mode-dependent):
   scene-by-scene drafting; never jump ahead; end each scene on its endpoint.
2. **Authoring-bible stable prelude** — pack prelude from
   `prompts/authoring-bible.packs.json` (L118/L119 rule IDs render here).
3. **Brief header** — plain lines:
   ```
   WRITER DRAFTING BRIEF
   Scene: <beatNumber> of <totalBeats>
   Budget: about <targetWords> words
   POV: <pov>
   Setting: <setting>
   Kind: <kind>
   Scene ID: <sceneId>          # raw mode only (L099; "suppress" hides Cluster-1 IDs)
   Beat ID: <beatId>            # raw mode only
   Task: <description>
   Characters present: <names>
   ```
4. **Scene load control** (when `mode` enables; `targetWords` guidance).
5. **Scene contract brief** — rendered from `plan/chNN.yaml` scene entry
   (fields per `prompts/planner-contract.md`; shape summary metrics:
   anchor/dramatic/endpoint/choice fields, from
   `src/agents/writer/scene-contract-shape.ts` — ported shape at
   `checks/contract-shape.ts`).
6. **Source availability boundary** — from
   `src/agents/writer/source-availability-checker.ts`: what the writer is
   allowed to reference (canon/seed material) vs boundary-redacted reveal
   terms. Rendered as a prose block with `[source-availability]` tags.
7. **Authoring-bible scene slice** — rules whose `appliesWhen` matches this
   scene (id-rendered; `suppress` hides Cluster-1 wildcard matches).
8. **Obligations** — from the scene contract:
   ```
   OBLIGATIONS:
   - "<obligation text>" [obligationId=...]
   ```
9. **Fact continuity anchors** (implemented) — from the plan's continuity
   contract (version 1, below): the chapter's schedule fact first, then the
   canon facts pinned by `continuity_anchors.fact_ids`, resolved against
   `canon/facts.md` with IDs retained. Legacy plans render the
   legacy-unavailable marker instead (never fabricated state).
10. **Continuity anchors** (implemented) — chapter-start character states
    from `continuity_anchors.character_states`, filtered to the characters
    present in this scene (same case-insensitive match as the CHARACTERS
    section). Legacy plans render the legacy-unavailable marker.
11. **Character section brief** — character snapshots (name, capsule,
    relationship arcs present in scene).
12. **Character context capsules** (mode-dependent) — capsules from
    `src/agents/writer/character-context.ts` (character states →
    summaries/traces; render via `renderCharacterContextCapsules`).
13. **Resolved references text** — cross-references resolved from canon
    (id → text inlining, per `reference-resolver.ts`).
14. **Reader info state** (implemented) — `READER KNOWS` /
    `WITHHOLD FROM READER` from the plan's `reader_info`, fact IDs resolved
    against `canon/facts.md` (reveal discipline: a withheld fact must not
    also appear as reader-known — enforced by validation, not the renderer).
    Legacy plans render the legacy-unavailable marker.
15. **Setting brief** — `settings` entry for the scene location
    (world-bible file slice).
16. **Beat target** — the `chNN.md` assembled chapter target (only in
    chapter-assembly mode; scene mode skips).

## Continuity contract (version 1) — plan fields the brief renders

The plan pins one explicit schedule fact per chapter and carries
chapter-start continuity anchors + reader-information state, so the writer
cannot casually invent a conflicting date or reveal a withheld fact
(LESSONS L-2). Top-level fields in `plan/chNN.yaml`:

```yaml
continuity_contract_version: 1
schedule_fact:
  fact_id: schedule-chNN        # convention; nonblank
  text: "one explicit chapter schedule statement"
continuity_anchors:
  fact_ids: [fact-1]            # resolve against canon/facts.md
  character_states:
    - character: "Name"
      location: "chapter-start location"
      emotional: "chapter-start emotional state"
      knows: ["known item"]
      does_not_know: ["withheld from character"]
reader_info:
  knows_fact_ids: [fact-1]
  withhold_fact_ids: [fact-2]
```

### Validation (fail closed, before any LLM drafting)

- `continuity_contract_version` must be `1`.
- `schedule_fact.fact_id` / `schedule_fact.text`: nonblank strings; `text`
  is the single explicit schedule statement for the chapter.
- `continuity_anchors.fact_ids`: string array; every ID must resolve to a
  row in `canon/facts.md` (unknown ID → fail); no ID may be listed twice.
- `continuity_anchors.character_states`: array; each entry has nonblank
  `character` / `location` / `emotional`; `knows` / `does_not_know` are
  string arrays (may be empty); the same character may not be anchored
  twice (case-insensitive).
- `reader_info.knows_fact_ids` / `withhold_fact_ids`: string arrays; every
  ID resolves against `canon/facts.md`; no ID may be listed twice within
  one list; the two must not overlap (a withheld fact may not also be
  reader-known).
- `canon/facts.md` itself must carry unique fact IDs (explicit or
  implicit) — duplicate canon IDs fail validation.
- Any new field or version present → the whole contract is required and
  validated; partial version-1 data is never silently accepted.
- Generated/new plans (planner output) must be version 1 — the plan step
  fails closed before the file is written.
- Legacy plans (none of `continuity_contract_version`, `schedule_fact`,
  `continuity_anchors`, `reader_info` present) remain readable: the brief
  renders the legacy-unavailable marker and must not fabricate state.

### Rendering (exact)

Stable order for the implemented surface: header (3) → scene contract (5)
→ obligations (8) → `FACT CONTINUITY ANCHORS` (9) → `CONTINUITY ANCHORS`
(10) → `CHARACTERS` (11) → `READER INFO STATE` (14).

```
FACT CONTINUITY ANCHORS:
  schedule: [id=<schedule_fact.fact_id>] <schedule_fact.text>
  - [id=fact-1] <fact text resolved from canon/facts.md>

CONTINUITY ANCHORS:
  Alory Vane:
    location: <chapter-start location>
    emotional: <chapter-start emotional state>
    knows:
      - <known item>
    does not know:
      - <withheld item>

READER INFO STATE:
  READER KNOWS:
    - [id=fact-1] <fact text resolved from canon/facts.md>
  WITHHOLD FROM READER:
    - [id=fact-2] <fact text resolved from canon/facts.md>
```

Rules:

- `FACT CONTINUITY ANCHORS` renders the schedule line first, then one line
  per `continuity_anchors.fact_ids` entry in plan order; IDs retained.
  Empty `fact_ids` renders `(none)` on its own line (the schedule line is
  always present — it is required in version 1).
- `CONTINUITY ANCHORS` renders only `character_states` entries whose
  `character` matches a name in the scene's `characters` list
  (case-insensitive). Empty `knows` / `does_not_know` render `(none)`
  inline (e.g. `knows: (none)`). No matching entry renders
  `CONTINUITY ANCHORS:` + `  (none)`.
- `READER INFO STATE` always renders both subsections; an empty list
  renders `(none)` under that subsection.
- Empty lists render an honest `(none)` rather than disappearing.
- Legacy plans (no contract fields): the continuity slot (between
  `OBLIGATIONS` and `CHARACTERS`) renders the single concise marker line
  `CONTINUITY: (legacy plan — no continuity contract; continuity anchors
  and reader-info state unavailable)` — never fabricated state; the three
  section headers are not rendered.

## Mode notes

- `drafting-brief-tight-v1` — no authoring-bible sections; load control on.
- `drafting-brief-authoring-bible-v1` — full assembly above (proposal:
  authoring-bible packs render into writer context, L118).
- `idRendering`: `raw` (default, L099 trace IDs visible) or `suppress`
  (Cluster-1 raw-ID lines hidden; used in source-portability arms).

## Source-of-truth excerpts (copied verbatim from old repo)

- `prompts/writer/beat-writer-system.md` — beat-level writer system prompt
- `prompts/writer/prose-writer-system.md` — prose-level writer system prompt
- `prompts/writer/style-primer-salvatore.md` — Salvatore style primer (genre
  voice exemplar; era-specific, per-novel primers replace it)
- `prompts/writer/voice-shaping.md` — extracted D1/D2/D3 voice-shaping
  fragments (`src/agents/writer/voice-shaping-prompts.ts`, ablation-only lane)

## Files-first bindings (phase 3)

| Old DB lookup | New file source |
| --- | --- |
| `getChapterOutline` | `novels/<name>/plan/chNN.yaml` |
| `getCharacters` / capsules | `novels/<name>/canon/characters.md` |
| `getWorldBible` / systems / cultures | `novels/<name>/canon/` (world.md, systems.md) |
| `getCharacterStatesAtChapter` | `plan/chNN.yaml` `continuity_anchors.character_states` (v1 contract); legacy plans: `state.md` + `feedback/chNN-1-review.md` end-state |
| `getFactsUpToChapter` | `canon/facts.md` (factId= IDs; resolved for continuity anchors + reader info) |
| `getOpenIssues` | `state.md` → open threads |
| retrieval / embeddings | dropped — files + exact-match reference resolver only |
| `getStorySpine` | `seed.md` story ask |
