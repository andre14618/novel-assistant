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
9. **Fact continuity anchors** (mode-enabled) — established facts this scene
   must not contradict; rendered with `[factId=...]` for raw mode.
10. **Continuity anchors** — character states at chapter start
    (location/emotional/knows/doesn't-know) from `state.md` + previous
    chapter's end-state.
11. **Character section brief** — character snapshots (name, capsule,
    relationship arcs present in scene).
12. **Character context capsules** (mode-dependent) — capsules from
    `src/agents/writer/character-context.ts` (character states →
    summaries/traces; render via `renderCharacterContextCapsules`).
13. **Resolved references text** — cross-references resolved from canon
    (id → text inlining, per `reference-resolver.ts`).
14. **Reader info state** — what the reader already knows vs what this scene
    must withhold (reveal discipline).
15. **Setting brief** — `settings` entry for the scene location
    (world-bible file slice).
16. **Beat target** — the `chNN.md` assembled chapter target (only in
    chapter-assembly mode; scene mode skips).

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
| `getCharacterStatesAtChapter` | `state.md` + `feedback/chNN-1-review.md` end-state |
| `getFactsUpToChapter` | `canon/facts.md` (factId= IDs) |
| `getOpenIssues` | `state.md` → open threads |
| retrieval / embeddings | dropped — files + exact-match reference resolver only |
| `getStorySpine` | `seed.md` story ask |
