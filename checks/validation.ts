/**
 * checks/validation.ts — deterministic chapter validation.
 *
 * Ported from novel-harness src/validation.ts (validateChapterDraft),
 * adapted to a plain outline interface (no DB, no harness types).
 * Preserves severity semantics: word count is advisory; POV/beat
 * coverage can block.
 */

export interface SceneLike {
  description: string
  sceneId?: string
  beatId?: string
}

export interface ChapterOutlineLike {
  chapterNumber: number
  title?: string
  targetWords: number
  povCharacter: string
  charactersPresent: string[]
  scenes: SceneLike[]
}

export interface ValidationFinding {
  severity: "blocker" | "warning"
  code: string
  description: string
  metadata?: Record<string, unknown>
}

export interface ValidationResult {
  passed: boolean
  blockers: string[]
  warnings: string[]
  findings: ValidationFinding[]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function nameInDraft(name: string, draftLower: string): boolean {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ")
  if (!normalized) return false

  const candidates = new Set<string>([normalized])
  const parts = normalized.split(/\s+/).filter(part => part.length >= 3)
  if (parts[0]) candidates.add(parts[0])
  if (parts.length > 1) candidates.add(parts[parts.length - 1]!)

  for (const candidate of candidates) {
    if (new RegExp(`\\b${escapeRegExp(candidate)}\\b`).test(draftLower)) return true
  }
  return false
}

export function validateChapterDraft(
  draft: string,
  outline: ChapterOutlineLike,
  mode: "drafting" | "validation" = "drafting",
): ValidationResult {
  const blockers: string[] = []
  const warnings: string[] = []
  const findings: ValidationFinding[] = []

  const addFinding = (
    severity: ValidationFinding["severity"],
    code: string,
    description: string,
    metadata?: Record<string, unknown>,
  ) => {
    findings.push({ severity, code, description, metadata })
    if (severity === "blocker") blockers.push(description)
    else warnings.push(description)
  }

  const wordCount = draft.split(/\s+/).filter(Boolean).length

  // Word count is advisory. Structure, POV, and beat coverage can block.
  if (wordCount < 500) {
    addFinding("warning", "word_count_min", `Chapter too short: ${wordCount} words (minimum 500)`, { wordCount, minimumWords: 500 })
  } else if (wordCount < outline.targetWords * 0.5) {
    addFinding("warning", "word_count_far_below", `Chapter far below target: ${wordCount} words (target: ${outline.targetWords})`, { wordCount, targetWords: outline.targetWords })
  } else if (wordCount < outline.targetWords * 0.7) {
    addFinding("warning", "word_count_below_target", `Chapter below target: ${wordCount} words (target: ${outline.targetWords})`, { wordCount, targetWords: outline.targetWords })
  }

  if (wordCount > outline.targetWords * 2) {
    addFinding("warning", "word_count_very_long", `Chapter very long: ${wordCount} words (target: ${outline.targetWords})`, { wordCount, targetWords: outline.targetWords })
  }

  // POV character must appear (check full name and first name)
  const draftLower = draft.toLowerCase()
  if (!nameInDraft(outline.povCharacter, draftLower)) {
    addFinding("blocker", "pov_missing", `POV character "${outline.povCharacter}" never mentioned in draft`, { povCharacter: outline.povCharacter })
  }

  // Check other characters are mentioned
  for (const charName of outline.charactersPresent) {
    if (!nameInDraft(charName, draftLower)) {
      addFinding("warning", "character_missing", `Character "${charName}" listed but never mentioned`, { characterName: charName })
    }
  }

  // Validation-mode-only checks
  if (mode === "validation") {
    // Scene beat keyword coverage
    for (let i = 0; i < outline.scenes.length; i++) {
      const beat = outline.scenes[i]!
      const keywords = beat.description
        .split(/\s+/)
        .map(w => w.toLowerCase().replace(/[^a-z]/g, ""))
        .filter(w => w.length > 4)

      if (keywords.length > 0) {
        const matched = keywords.filter(kw => draftLower.includes(kw))
        const ratio = matched.length / keywords.length

        if (matched.length === 0) {
          addFinding("blocker", "beat_keyword_missing", `Scene beat ${i + 1} has no keyword matches — may be missing entirely`, { beatIndex: i, keywordCount: keywords.length })
        } else if (ratio < 0.4) {
          addFinding("warning", "beat_keyword_low_coverage", `Scene beat ${i + 1} has low keyword coverage (${matched.length}/${keywords.length})`, { beatIndex: i, matchedKeywords: matched.length, keywordCount: keywords.length })
        }
      }
    }

    // POV pronoun check — flag first-person "I" outside dialogue
    const nonDialogue = draft.replace(/"[^"]*"/g, "")
    const firstPersonCount = (nonDialogue.match(/\bI\b/g) ?? []).length
    if (firstPersonCount > 5) {
      addFinding("warning", "pov_first_person_possible", `Found ${firstPersonCount} first-person "I" outside dialogue — possible POV violation`, { firstPersonCount })
    }

    // Dialogue presence check
    const nonEmptyLines = draft.split("\n").filter(l => l.trim().length > 0)
    const dialogueLines = nonEmptyLines.filter(l => l.includes('"'))
    if (nonEmptyLines.length > 0) {
      const ratio = dialogueLines.length / nonEmptyLines.length
      if (dialogueLines.length === 0) {
        addFinding("warning", "dialogue_missing", "No dialogue found in chapter", { nonEmptyLines: nonEmptyLines.length })
      } else if (ratio > 0.7) {
        addFinding("warning", "dialogue_heavy", `Very dialogue-heavy: ${dialogueLines.length}/${nonEmptyLines.length} lines contain dialogue`, { dialogueLines: dialogueLines.length, nonEmptyLines: nonEmptyLines.length })
      }
    }
  }

  return {
    passed: blockers.length === 0,
    blockers,
    warnings,
    findings,
  }
}
