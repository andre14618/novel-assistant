import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { validatePlanContinuity, type NovelDir, type PlanChapter } from "./novel"

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

// ── Plan continuity contract (phase-5 backlog item 2, LESSONS L-2) ────────
// Canonical types + validation live in src/loop/novel.ts (single rule
// source); the brief only renders the validated contract (see
// renderWriterBrief), which calls validatePlanContinuity imported above.

/** Resolve canon fact ids to rows, order-preserving (unknown ids skipped — validation forbids them). */
function resolveFactRows(canon: NovelDir["canon"], ids: string[]): FactRow[] {
  const byId = new Map(parseFacts(canon["facts.md"] ?? "").map(f => [f.id, f]))
  const rows: FactRow[] = []
  for (const id of ids) {
    const row = byId.get(id)
    if (row) rows.push(row)
  }
  return rows
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

/**
 * Brief header + scene contract + obligations + continuity sections per
 * writer-brief.md (steps 3/5/8/9/10/14).
 *
 * Stable section order (cache-prefix discipline): header, SCENE CONTRACT,
 * OBLIGATIONS, FACT CONTINUITY ANCHORS (schedule first, then canon facts
 * with ids), CONTINUITY ANCHORS (chapter-start states, scene-present
 * characters only), CHARACTERS, READER INFO STATE (READER KNOWS / WITHHOLD
 * FROM READER). Legacy plans (no continuity-contract fields) render a
 * concise unavailable marker in place of the continuity sections and never
 * fabricate state; a plan with partial/invalid version-1 fields throws
 * (fail closed). Empty lists render an honest `(none)`.
 */
export function renderWriterBrief(plan: PlanChapter, canon: NovelDir["canon"], sceneIndex: number): string {
  const scene = plan.scenes[sceneIndex]
  if (!scene) throw new Error(`scene index ${sceneIndex} out of range (${plan.scenes.length} scenes)`)

  const continuity = validatePlanContinuity(plan, canon, { required: false })
  if (!continuity.ok) {
    throw new Error(`writer brief: invalid continuity contract: ${continuity.errors.join("; ")}`)
  }
  const contract = continuity.contract

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

  if (contract) {
    // writer-brief.md step 9 — fact continuity anchors: the chapter's pinned
    // schedule fact first, then canon facts resolved with ids retained.
    lines.push("FACT CONTINUITY ANCHORS:")
    lines.push(`  schedule: [id=${contract.schedule_fact.fact_id}] ${contract.schedule_fact.text}`)
    const anchorFacts = resolveFactRows(canon, contract.continuity_anchors.fact_ids)
    if (anchorFacts.length > 0) {
      for (const f of anchorFacts) lines.push(`  - [id=${f.id}] ${f.fact}`)
    } else {
      lines.push("  (none)")
    }
    lines.push("")

    // writer-brief.md step 10 — chapter-start character states, only for
    // characters present in this scene.
    lines.push("CONTINUITY ANCHORS:")
    const sceneChars = (scene.characters.length > 0 ? scene.characters : plan.characters_present).map(n => n.toLowerCase())
    const states = contract.continuity_anchors.character_states.filter(cs => sceneChars.includes(cs.character.toLowerCase()))
    if (states.length > 0) {
      for (const cs of states) {
        lines.push(`  ${cs.character}:`)
        lines.push(`    location: ${cs.location}`)
        lines.push(`    emotional: ${cs.emotional}`)
        if (cs.knows.length > 0) {
          lines.push("    knows:")
          for (const k of cs.knows) lines.push(`      - ${k}`)
        } else {
          lines.push("    knows: (none)")
        }
        if (cs.does_not_know.length > 0) {
          lines.push("    does not know:")
          for (const k of cs.does_not_know) lines.push(`      - ${k}`)
        } else {
          lines.push("    does not know: (none)")
        }
      }
    } else {
      lines.push("  (none)")
    }
    lines.push("")
  } else {
    // Legacy plan: honest marker in the continuity slot, no fabricated state.
    lines.push("CONTINUITY: (legacy plan — no continuity contract; continuity anchors and reader-info state unavailable)")
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

  if (contract) {
    // writer-brief.md step 14 — reader info state (reveal discipline).
    lines.push("READER INFO STATE:")
    lines.push("  READER KNOWS:")
    const knownFacts = resolveFactRows(canon, contract.reader_info.knows_fact_ids)
    if (knownFacts.length > 0) {
      for (const f of knownFacts) lines.push(`    - [id=${f.id}] ${f.fact}`)
    } else {
      lines.push("    (none)")
    }
    lines.push("  WITHHOLD FROM READER:")
    const withheldFacts = resolveFactRows(canon, contract.reader_info.withhold_fact_ids)
    if (withheldFacts.length > 0) {
      for (const f of withheldFacts) lines.push(`    - [id=${f.id}] ${f.fact}`)
    } else {
      lines.push("    (none)")
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
