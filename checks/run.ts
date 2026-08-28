import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { validateChapterDraft, type ChapterOutlineLike } from "./validation"
import { detectProseIntegrityIssues, repairMechanicalQuoteIntegrity, repairMechanicalDuplicateIntegrity } from "./integrity"
import { detectSyncDefects, type QualityDefect } from "./quality"

/**
 * checks/run.ts — deterministic check gate (phase-2 evidence gate).
 *
 *   bun checks/run.ts <chapter.md> [outline.json]
 *
 * outline.json shape (see fixtures/cartographer-ch7.outline.json):
 *   { chapterNumber, title?, targetWords, povCharacter, charactersPresent, scenes: [{description, sceneId?, beatId?}] }
 *
 * Exits 1 if validation blockers or quality high-severity defects found.
 */

const [chapterPath, outlinePath] = process.argv.slice(2)
if (!chapterPath) {
  console.error("usage: bun checks/run.ts <chapter.md> [outline.json]")
  process.exit(2)
}

const draft = readFileSync(resolve(chapterPath), "utf-8")
let outline: ChapterOutlineLike
if (outlinePath) {
  outline = JSON.parse(readFileSync(resolve(outlinePath), "utf-8"))
} else {
  outline = {
    chapterNumber: 0,
    targetWords: 3000,
    povCharacter: "",
    charactersPresent: [],
    scenes: [],
  }
}

const wordCount = draft.split(/\s+/).filter(Boolean).length

const validation = validateChapterDraft(draft, outline, "validation")
const integrity = detectProseIntegrityIssues(draft)
const quality: QualityDefect[] = detectSyncDefects(draft)
const quoteRepair = repairMechanicalQuoteIntegrity(draft)
const dupRepair = repairMechanicalDuplicateIntegrity(draft)

console.log(`file: ${chapterPath}`)
console.log(`words: ${wordCount}`)
console.log(`outline: ch${outline.chapterNumber} pov=${outline.povCharacter} target=${outline.targetWords} characters=[${outline.charactersPresent.join(", ")}] scenes=${outline.scenes.length}`)
console.log("")

console.log(`validation: ${validation.blockers.length} blocker(s), ${validation.warnings.length} warning(s)`)
for (const f of validation.findings) {
  console.log(`  [${f.severity}] ${f.code}: ${f.description}`)
}

console.log("")
console.log(`integrity: ${integrity.length} issue(s)`)
const byKind = new Map<string, number>()
for (const issue of integrity) byKind.set(issue.kind, (byKind.get(issue.kind) ?? 0) + 1)
for (const [kind, count] of [...byKind.entries()].sort()) {
  console.log(`  ${kind}: ${count}`)
  const sample = integrity.find(i => i.kind === kind)
  if (sample) console.log(`    e.g. "${sample.excerpt}"`)
}

console.log("")
console.log(`quality: ${quality.length} defect(s)`)
for (const d of quality) {
  console.log(`  [${d.severity}] ${d.kind}: ${d.description}`)
}

console.log("")
console.log(`mechanical repairs available: quote=${quoteRepair.fixed} duplicate=${dupRepair.fixed} (paragraphs=${dupRepair.duplicateParagraphs}, sentences=${dupRepair.duplicateSentences})`)

const hardFailures = validation.blockers.length + quality.filter(d => d.severity === "high").length > 0
console.log(hardFailures ? "\nGATE: FAIL (blockers/high-severity present)" : "\nGATE: PASS")
process.exit(hardFailures ? 1 : 0)
