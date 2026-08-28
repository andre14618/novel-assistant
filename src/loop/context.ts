import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { NovelDir, PlanChapter } from "./novel"

/**
 * src/loop/context.ts — file-first context assemblies.
 *
 * Renderers follow the specs in prompts/: planner-contract.md,
 * writer-brief.md (steps 3/5/8 + character capsules), reviewer/context-spec.md.
 * No DB, no embeddings: canon is file slices, facts are factId-tagged rows.
 */

const PROMPT_DIR = import.meta.dir + "/../../prompts"

export function readPrompt(path: string): string {
  return readFileSync(resolve(PROMPT_DIR, path), "utf-8")
}

// ── Canon facts ────────────────────────────────────────────────────────────

export interface FactRow {
  id: string
  category: string
  fact: string
}

/** Parse canon/facts.md rows: `- [category] [id=fact-1] fact text`. */
export function parseFacts(factsMd: string): FactRow[] {
  const rows: FactRow[] = []
  for (const line of factsMd.split("\n")) {
    const m = line.match(/^\s*-\s*\[([^\]]+)\]\s*(?:\[id=([^\]]+)\]\s*)?(.*)$/)
    if (!m) continue
    const id = m[2] ?? `fact-${rows.length + 1}`
    const fact = m[3]!.trim()
    if (fact) rows.push({ id, category: m[1]!.trim(), fact })
  }
  return rows
}

// ── Planner context ────────────────────────────────────────────────────────

export function renderPlannerContext(novel: NovelDir, chapterN: number): string {
  const sections: string[] = []
  if (novel.seed) sections.push("STORY ASK:\n" + novel.seed.trim())
  for (const [file, content] of Object.entries(novel.canon)) {
    sections.push(`CANON SLICE (${file}):\n` + content.trim())
  }
  sections.push(`CHAPTER TO PLAN: ${chapterN} (horizon = 1 chapter; future reveal terms boundary-redacted)`)
  const statePath = novel.statePath
  try {
    sections.push(`STATE:\n` + readFileSync(statePath, "utf-8").trim())
  } catch { /* no state file yet */ }
  try {
    sections.push("LESSONS:\n" + readFileSync(resolve(import.meta.dir + "/../../LESSONS.md"), "utf-8").trim())
  } catch { /* no lessons yet */ }
  // Previous chapter review, if any
  try {
    sections.push(`FEEDBACK ch${chapterN - 1}:\n` + readFileSync(novel.feedbackPath(chapterN - 1), "utf-8").trim())
  } catch { /* first chapter */ }
  return sections.join("\n\n")
}

// ── Writer brief (writer-brief.md assembly spec) ───────────────────────────

export interface BriefCharacter {
  name: string
  voice: string
  drives: string
  avoids: string
}

/** Parse canon/characters.md: `## Name` sections with Voice/Drives/Avoids lines. */
export function parseCharacters(charactersMd: string): BriefCharacter[] {
  const chars: BriefCharacter[] = []
  let current: BriefCharacter | null = null
  for (const line of charactersMd.split("\n")) {
    const header = line.match(/^#{1,3}\s+(.+)$/)
    if (header && !current) {
      current = { name: header[1]!.trim(), voice: "", drives: "", avoids: "" }
      chars.push(current)
      continue
    }
    if (current) {
      const field = line.match(/^\s*[-*]\s*(Voice|Drives|Avoids):\s*(.*)$/)
      if (field) {
        if (field[1] === "Voice") current.voice = field[2]!.trim()
        if (field[1] === "Drives") current.drives = field[2]!.trim()
        if (field[1] === "Avoids") current.avoids = field[2]!.trim()
      }
    }
  }
  return chars
}

/** Brief header + scene contract + obligations per writer-brief.md steps 3/5/8. */
export function renderWriterBrief(plan: PlanChapter, canon: NovelDir["canon"], sceneIndex: number): string {
  const scene = plan.scenes[sceneIndex]
  if (!scene) throw new Error(`scene index ${sceneIndex} out of range (${plan.scenes.length} scenes)`)
  const charactersMd = canon["characters.md"] ?? ""
  const chars = parseCharacters(charactersMd)
  const present = chars.filter(c => scene.characters.some(n => c.name.toLowerCase() === n.toLowerCase()))

  const lines: string[] = [
    "WRITER DRAFTING BRIEF",
    `Scene: ${sceneIndex + 1} of ${plan.scenes.length}`,
    `Budget: about ${scene.target_words ?? plan.target_words} words`,
    `POV: ${plan.pov}`,
    `Setting: ${scene.anchors?.place ?? plan.setting}`,
    `Kind: ${scene.kind ?? "?"}`,
    scene.scene_id ? `Scene ID: ${scene.scene_id}` : "",
    scene.beat_id ? `Beat ID: ${scene.beat_id}` : "",
    "",
    `Task: ${scene.description}`,
    `Characters present: ${scene.characters.join(", ") || plan.characters_present.join(", ")}`,
    "",
  ].filter(l => l !== "")

  const dramatic = scene.dramatic ?? {}
  if (Object.keys(dramatic).length > 0) {
    lines.push("SCENE CONTRACT:")
    for (const [k, v] of Object.entries(dramatic)) lines.push(`  ${k}: ${String(v)}`)
    if (scene.endpoint) lines.push(`  endpoint: ${scene.endpoint}`)
    lines.push("")
  }

  if (scene.obligations?.length) {
    lines.push("OBLIGATIONS:")
    for (const o of scene.obligations) {
      lines.push(`- "${o.text}"${o.obligation_id ? ` [obligationId=${o.obligation_id}]` : ""}`)
    }
    lines.push("")
  }

  if (present.length > 0) {
    lines.push("CHARACTERS:")
    for (const c of present) {
      lines.push(`${c.name}:`)
      lines.push(`  Voice: ${c.voice || "—"}`)
      lines.push(`  Drives: ${c.drives || "—"}`)
      lines.push(`  Avoids: ${c.avoids || "—"}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

// ── Reviewer context (reviewer/context-spec.md) ────────────────────────────

export function renderReviewerContext(
  plan: PlanChapter,
  canon: NovelDir["canon"],
  prose: string,
  chapterN: number,
): string {
  const facts = parseFacts(canon["facts.md"] ?? "")
  const plannedState = {
    establishedFacts: plan.facts_to_establish ?? [],
    characterStateChanges: plan.character_state_changes ?? [],
    knowledgeChanges: plan.knowledge_changes ?? [],
  }
  const sections: string[] = [
    "EVIDENCE_TIERS:",
    "required: PLAN, PLANNED_STATE, CHAPTER_PROSE, ESTABLISHED_FACTS, END-OF-PREVIOUS-CHAPTER CHARACTER STATES.",
    "supporting: beat descriptions and planned character lists identify the intended beat job.",
    "inventory: none.",
    "",
    "CHAPTER:",
    JSON.stringify({
      chapterNumber: plan.chapter,
      title: plan.title,
      povCharacter: plan.pov,
      setting: plan.setting,
      purpose: plan.purpose,
    }, null, 2),
    "",
    "PLAN:",
    JSON.stringify(plan.scenes, null, 2),
    "",
    "PLANNED_STATE:",
    JSON.stringify(plannedState, null, 2),
    "",
    "ESTABLISHED_FACTS:",
    facts.map(f => `- [${f.category}] [id=${f.id}] ${f.fact}`).join("\n") || "(none recorded)",
    "",
    "END-OF-PREVIOUS-CHAPTER CHARACTER STATES:",
    plannedState.characterStateChanges.length
      ? JSON.stringify(plannedState.characterStateChanges, null, 2)
      : "(first chapter)",
    "",
    "CHAPTER PROSE:",
    prose,
  ]
  void chapterN
  return sections.join("\n")
}
