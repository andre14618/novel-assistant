# Voice-shaping fragments (D1/D2/D3)

Extracted from `novel-harness/src/agents/writer/voice-shaping-prompts.ts`
(ablation-only lane, not production). Three independent interventions; each
is a version-controlled text fragment injected into the writer prompt.

## D1 — textual style guide (system-prompt addendum)

```
VOICE STYLE GUIDE:

The target voice is heroic fantasy with restraint — the kind of prose
that reads like an oral storyteller who's earned the right to be brief.
Aim for these textures:

- **Cadence.** Mostly declarative, averaging ~20 words per sentence
  with meaningful variation. Land on a short sentence after a longer
  passage when a beat needs emphasis. Avoid uniformity; rhythm is
  earned by contrast.
- **Dialogue.** When characters speak, they speak directly. Favor
  short lines over extended speeches. Attribution is simple ("said",
  "asked", "muttered") and often left implicit when two characters
  alternate. Dialogue makes up roughly a quarter to a third of prose
  by volume in scenes where it happens.
- **Clause complexity.** Moderate — around one comma or semicolon
  per sentence on average. Compound structures are welcome when they
  carry weight, but multiple subordinate clauses per sentence dilute
  impact.
- **Sensory density.** Sparing and deliberate. Name a specific
  sensory detail (cold iron, pine smoke, sweat on the haft of a
  weapon) where it carries meaning. Do not atmospherize at the
  expense of forward motion.
- **Interiority.** Favor externalized stakes over long internal
  monologue. When interiority is warranted, prefer one decisive
  thought or a brief remembered fact over a paragraph of reflection.
- **What to avoid.** Excessive adjective stacking. Abstractions
  ("a sense of", "the feeling of") where concrete images would do.
  Narrator commentary on the character's own state. Metaphor strain
  that slows the sentence.

Write as if the reader is smart and the page is expensive.
```

## D2 — few-shot reference passages (system-prompt addendum)

Header text (passages loaded from `voice-reference-passages.json`,
first 5, each ≤ ~400w):

```
VOICE REFERENCE PASSAGES:

Below are example passages that embody the target voice. They are
EXAMPLES of cadence, register, dialogue pattern, and sensory economy —
NOT templates to copy, NOT characters or settings to reuse. Produce
your own beat with the beat's own characters, setting, and action,
but match the rhythmic and textural qualities of these examples.

--- Example 1 (<N>w) ---
<passage prose>
--- End of examples ---
```

## D3 — per-character voice directives (user-prompt CHARACTERS replacement)

```
CHARACTER VOICE DIRECTIVES:

When multiple characters speak in this beat, their dialogue and
attributed action MUST be distinguishable from each other without
the attribution tag. Use these levers:

- **Cadence signature:** one character favors clipped imperatives;
  another uses longer contemplative constructions; a third speaks
  in fragments under stress. Differentiate rhythmically.
- **Register band:** pick a vocabulary tier per character and hold
  it — formal/archaic for scholars, vernacular/direct for fighters,
  figurative/indirect for diplomats. No character should slip out
  of their band within this beat.
- **Signature phrasings:** if a character has a recurring figure
  of speech or habitual construction (from the Voice or example
  lines below), USE IT at least once when they speak.
- **Dialogue tag variety:** avoid attaching every line to "said."
  Use physical attribution ("she gripped the blade and answered"),
  implicit attribution in alternating dialogue, or the occasional
  specific verb ("muttered", "pressed"). One-third rule: no more
  than 1/3 of dialogue lines attributed with "said."

Read each character's profile below and commit to ONE distinct
rhythmic + register choice per character before writing. If two
characters' profiles are close, invent the distinction at the
prose layer — do not let them blur.

--- Character profiles ---
<character entries>
```

## Provenance

- Arms: D0-bare (baseline), D1 (+style guide), D2 (+reference passages),
  D3 (+character directives). Cell labels preserved for A/B telemetry
  (`session_id` tags in phase 3).
- Note (old repo §10.1 RED finding #4): D2/D3 style analysis is
  per-novel — the Salvatore primer in `prompts/writer/style-primer-salvatore.md`
  is era-specific. A new novel gets its own primer/reference passages.
