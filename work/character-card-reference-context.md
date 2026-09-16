# Scaffold file-first Character Card reference context

## Outcome

Create a small, typed Character Card module that turns the existing
`canon/characters.md` file into validated, scene-specific writer context. The
writer brief should depend on this module instead of owning character parsing
and selection itself.

The current parser creates a card only for the first heading, so fields from
later sections can overwrite that first character. This scaffold must make
per-character identity correct and directly tested before expanding the card
format.

## Change packet

- **Surface:** `src/loop/context.ts`, a new focused module under `src/loop/`,
  focused tests, and the writer-brief documentation.
- **Exact change:** extract Character Card parsing, reference resolution,
  scene selection, validation, and stable rendering behind one small interface.
- **Expected benefit:** character identity and prompt context rules have one
  source of truth, fail before an LLM call, and can grow without expanding the
  writer-brief renderer.
- **Downstream projection:** later character-state, relationship, or fixer work
  can request cards through the same module, but this ticket implements no such
  expansion.
- **Evidence gate:** deterministic unit tests, existing writer-brief tests,
  the full test suite, and typechecking pass.

## Required scaffold

1. Add a `CharacterCard` type containing a stable reference, name, voice,
   drives, avoids, and optional example text.
2. Parse the existing `canon/characters.md` section format. Support an optional
   explicit reference in a heading such as
   `## Kael Rusk [id=character-kael-rusk]`; derive a deterministic normalized
   reference from the name when the ID is absent so current files remain valid.
3. Resolve requested scene characters by reference or name, case-insensitively,
   preserving the scene plan's order.
4. Fail before an LLM call on duplicate references, duplicate character names,
   unresolved requested characters, or malformed cards. Error messages must
   identify the offending reference or name.
5. Render only the requested Character Cards in the current stable
   `CHARACTERS:` format. Existing legacy card input must keep the current writer
   brief text unchanged to protect prompt-cache stability.
6. Make `renderWriterBrief` call the Character Card module rather than parsing
   or filtering cards itself.
7. Document the file-first card format and reference rules concisely in
   `prompts/writer-brief.md`.

## Acceptance

- Focused tests prove explicit and derived references, case-insensitive lookup,
  plan-order rendering, legacy-output compatibility, duplicate rejection,
  malformed-card rejection, and unresolved-reference rejection.
- Existing continuity-contract and legacy writer-brief tests pass unchanged.
- `bun test` passes.
- `bun run typecheck` passes.
- The candidate changes only the new Character Card module, writer-context
  integration, focused tests, and concise documentation.

## Exclusions

- Do not edit production novel files under `novels/`, including Rillgate canon.
- No database table, embeddings, semantic retrieval, recursive canon directory,
  UI, network call, new dependency, or provider/configuration change.
- Do not add relationship graphs, dynamic character state, prompt experiments,
  fixer behavior, or a second character source of truth.
- Do not merge, push, deploy, access credentials, or modify `calls.db`.

## Authority

May add the focused Character Card module, refactor the writer-brief integration,
add deterministic tests, update the concise writer-brief documentation, run
local checks, and commit the exact candidate inside the contained sandbox.
