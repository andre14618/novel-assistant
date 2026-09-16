import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { parse, stringify } from "yaml"

/**
 * src/loop/novel.ts — file-first novel directory access.
 *
 * Layout (proposal §5):
 *   novels/<name>/seed.md, canon/*.md, plan/chNN.yaml,
 *   chapters/chNN.md, feedback/chNN-review.md, state.md
 */

export interface StateDoc {
  currentChapter: number
  openThreads: string[]
  notes: string[]
}

const DEFAULT_STATE: StateDoc = { currentChapter: 0, openThreads: [], notes: [] }

export interface NovelDir {
  base: string
  name: string
  seed: string | null
  canon: Record<string, string>
  planPath: (n: number) => string
  chapterPath: (n: number) => string
  feedbackPath: (n: number) => string
  reviewPath: (n: number) => string
  statePath: string
}

export function resolveNovelBase(dirOrName: string): string {
  const asPath = resolve(dirOrName)
  if (existsSync(asPath)) return asPath
  const convention = resolve(import.meta.dir + "/../../novels/" + dirOrName)
  if (existsSync(convention)) return convention
  throw new Error(`novel dir not found: '${dirOrName}' (tried '${asPath}' and '${convention}')`)
}

export function openNovel(dirOrName: string): NovelDir {
  const base = resolveNovelBase(dirOrName)
  const name = base.split("/").pop()!
  const canonDir = join(base, "canon")
  const canon: Record<string, string> = {}
  if (existsSync(canonDir)) {
    for (const f of readdirSync(canonDir).filter(f => f.endsWith(".md")).sort()) {
      canon[f] = readFileSync(join(canonDir, f), "utf-8")
    }
  }
  return {
    base,
    name,
    seed: existsSync(join(base, "seed.md")) ? readFileSync(join(base, "seed.md"), "utf-8") : null,
    canon,
    planPath: n => join(base, "plan", `ch${String(n).padStart(2, "0")}.yaml`),
    chapterPath: n => join(base, "chapters", `ch${String(n).padStart(2, "0")}.md`),
    feedbackPath: n => join(base, "feedback", `ch${String(n).padStart(2, "0")}-review.md`),
    reviewPath: n => join(base, "reviews", `ch${String(n).padStart(2, "0")}.review.json`),
    statePath: join(base, "state.md"),
  }
}

export function readState(novel: NovelDir): StateDoc {
  if (!existsSync(novel.statePath)) return { ...DEFAULT_STATE }
  const doc: StateDoc = { ...DEFAULT_STATE }
  for (const line of readFileSync(novel.statePath, "utf-8").split("\n")) {
    const m = line.match(/^(\w+):\s*(.*)$/)
    if (!m) continue
    const key = m[1]!
    const value = m[2]!.trim()
    if (key === "current_chapter") doc.currentChapter = Number(value) || 0
    else if (key === "open_threads") doc.openThreads = value ? value.split(",").map(s => s.trim()).filter(Boolean) : []
    else if (key === "note") doc.notes.push(value)
  }
  return doc
}

export function writeState(novel: NovelDir, state: StateDoc): void {
  const lines = [
    `current_chapter: ${state.currentChapter}`,
    `open_threads: ${state.openThreads.join(", ")}`,
    ...state.notes.map(n => `note: ${n}`),
    "",
  ]
  writeFileSync(novel.statePath, lines.join("\n"))
}

export interface PlanChapter {
  chapter: number
  title: string
  pov: string
  setting: string
  purpose: string
  target_words: number
  characters_present: string[]
  scenes: PlanScene[]
  facts_to_establish: string[]
  knowledge_changes: Array<{ character: string; id?: string; knowledge: string; source?: string }>
  character_state_changes: Array<{ name: string; id?: string; location: string; emotional: string; knows?: string[]; does_not_know?: string[] }>
  /** Continuity contract (phase 5 backlog 2, LESSONS L-2). Absent on all
   *  four keys = legacy plan (readable, unvalidated). Present on any key =
   *  the whole version-1 contract is required and validated (fail closed). */
  continuity_contract_version?: number
  schedule_fact?: ScheduleFact
  continuity_anchors?: ContinuityAnchors
  reader_info?: ReaderInfo
}

// ── Continuity contract (phase 5 backlog 2, LESSONS L-2) ─────────────────
//
// A chapter plan pins one explicit schedule fact and carries continuity
// anchors + reader-info state so the writer cannot casually invent
// conflicting dates or reveal withheld facts. The writer brief renders
// these as FACT CONTINUITY ANCHORS, CONTINUITY ANCHORS (scene-present
// characters only) and READER INFO STATE.

export interface ScheduleFact {
  /** ID the chapter will establish in canon/facts.md (forward reference —
   *  not in canon at plan time, so not resolved against canon). */
  fact_id: string
  /** The one explicit schedule statement this chapter pins. */
  text: string
}

export interface CharacterStateAnchor {
  character: string
  location: string
  emotional: string
  /** Free-text items the character knows at chapter start. */
  knows: string[]
  /** Free-text items withheld from the character at chapter start. */
  does_not_know: string[]
}

export interface ContinuityAnchors {
  /** Canon fact IDs (canon/facts.md) this chapter must not contradict. */
  fact_ids: string[]
  /** Chapter-start states; the brief renders only characters present in the scene. */
  character_states: CharacterStateAnchor[]
}

export interface ReaderInfo {
  /** Canon fact IDs the reader already knows. */
  knows_fact_ids: string[]
  /** Canon fact IDs the reader must not be told yet. */
  withhold_fact_ids: string[]
}

export interface ContinuityContractV1 {
  continuity_contract_version: 1
  schedule_fact: ScheduleFact
  continuity_anchors: ContinuityAnchors
  reader_info: ReaderInfo
}

export interface PlanScene {
  scene_id?: string
  beat_id?: string
  kind?: string
  description: string
  characters: string[]
  anchors?: { temporal?: string; place?: string }
  dramatic?: Record<string, unknown>
  endpoint?: string
  obligations?: Array<{ text: string; obligation_id?: string }>
  target_words?: number
}

export function readPlan(novel: NovelDir, n: number): PlanChapter {
  const path = novel.planPath(n)
  if (!existsSync(path)) throw new Error(`no plan at ${path}`)
  const plan = parse(readFileSync(path, "utf-8")) as PlanChapter
  // Legacy plans (no continuity-contract fields) stay readable. Any opted-in
  // contract is validated against canon/facts.md before the plan reaches a
  // step — fail closed on partial/malformed version-1 data.
  assertContinuityContract(plan, canonFactIds(novel.canon))
  return plan
}

// ── Continuity-contract validation (fail closed) ─────────────────────────

const CONTRACT_KEYS = [
  "continuity_contract_version",
  "schedule_fact",
  "continuity_anchors",
  "reader_info",
] as const

/** True when the plan opts into the continuity contract (any contract key present). */
export function hasContinuityContract(plan: PlanChapter): boolean {
  const p = plan as Record<string, unknown>
  return CONTRACT_KEYS.some(k => p[k] !== undefined)
}

/**
 * Fact IDs available in canon/facts.md. Mirrors parseFacts (context.ts):
 * explicit `[id=...]` rows keep their ID; untagged rows get implicit
 * `fact-N` by row order (counting nonblank fact text only).
 */
export function extractFactIds(factsMd: string): string[] {
  const ids: string[] = []
  for (const line of factsMd.split("\n")) {
    const m = line.match(/^\s*-\s*\[([^\]]+)\]\s*(?:\[id=([^\]]+)\]\s*)?(.*)$/)
    if (!m) continue
    if (!m[3]!.trim()) continue
    ids.push(m[2] ? m[2]!.trim() : `fact-${ids.length + 1}`)
  }
  return ids
}

export function canonFactIds(canon: NovelDir["canon"]): Set<string> {
  return new Set(extractFactIds(canon["facts.md"] ?? ""))
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function isNonblankString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

/**
 * Validate the plan's continuity contract against canon fact IDs.
 * Returns all errors (empty = valid); does not throw.
 *
 * - No contract keys at all → legacy plan: always valid here (readable).
 * - Any contract key present → the whole version-1 contract is required:
 *   `continuity_contract_version: 1` + `schedule_fact` + `continuity_anchors`
 *   + `reader_info`, all well-formed. `fact_ids` / `knows_fact_ids` /
 *   `withhold_fact_ids` must resolve against canon/facts.md; knows and
 *   withhold must not overlap. `schedule_fact.fact_id` is the ID the
 *   chapter will establish (forward reference), so only nonblank is required.
 */
export function validateContinuityContract(plan: PlanChapter, knownFactIds: ReadonlySet<string>): string[] {
  if (!hasContinuityContract(plan)) return []
  const errors: string[] = []
  const p = plan as Record<string, unknown>

  const version = p["continuity_contract_version"]
  if (version === undefined) {
    errors.push("continuity_contract_version missing — when any continuity-contract field is present the whole version-1 contract is required")
  } else if (version !== 1) {
    errors.push(`continuity_contract_version: unsupported version ${JSON.stringify(version)} (supported: 1)`)
  }

  const sf = p["schedule_fact"]
  if (sf === undefined) {
    errors.push("schedule_fact missing — required: one explicit chapter schedule statement")
  } else if (!isRecord(sf)) {
    errors.push("schedule_fact: must be a mapping with fact_id and text")
  } else {
    if (!isNonblankString(sf.fact_id)) errors.push("schedule_fact.fact_id: must be a nonblank string (ID the chapter will establish in canon/facts.md)")
    if (!isNonblankString(sf.text)) errors.push("schedule_fact.text: must be a nonblank string (the one explicit schedule statement)")
  }

  const ca = p["continuity_anchors"]
  if (ca === undefined) {
    errors.push("continuity_anchors missing — required: fact_ids + character_states")
  } else if (!isRecord(ca)) {
    errors.push("continuity_anchors: must be a mapping with fact_ids and character_states")
  } else {
    const fids = ca.fact_ids
    if (fids === undefined) {
      errors.push("continuity_anchors.fact_ids: missing (array of canon fact IDs; [] allowed)")
    } else if (!Array.isArray(fids)) {
      errors.push("continuity_anchors.fact_ids: must be an array of canon fact IDs")
    } else {
      fids.forEach((id, i) => {
        if (!isNonblankString(id)) errors.push(`continuity_anchors.fact_ids[${i}]: must be a nonblank string`)
        else if (!knownFactIds.has(id)) errors.push(`continuity_anchors.fact_ids[${i}]: '${id}' not found in canon/facts.md`)
      })
    }
    const states = ca.character_states
    if (states === undefined) {
      errors.push("continuity_anchors.character_states: missing (array of chapter-start character states; [] allowed)")
    } else if (!Array.isArray(states)) {
      errors.push("continuity_anchors.character_states: must be an array")
    } else {
      states.forEach((st, i) => {
        if (!isRecord(st)) {
          errors.push(`continuity_anchors.character_states[${i}]: must be a mapping with character/location/emotional/knows/does_not_know`)
          return
        }
        for (const key of ["character", "location", "emotional"] as const) {
          if (!isNonblankString(st[key])) errors.push(`continuity_anchors.character_states[${i}].${key}: must be a nonblank string`)
        }
        for (const key of ["knows", "does_not_know"] as const) {
          const v = st[key]
          if (v === undefined) errors.push(`continuity_anchors.character_states[${i}].${key}: missing (array of strings; [] allowed)`)
          else if (!Array.isArray(v) || !v.every(isNonblankString)) errors.push(`continuity_anchors.character_states[${i}].${key}: must be an array of nonblank strings`)
        }
      })
    }
  }

  const ri = p["reader_info"]
  if (ri === undefined) {
    errors.push("reader_info missing — required: knows_fact_ids + withhold_fact_ids")
  } else if (!isRecord(ri)) {
    errors.push("reader_info: must be a mapping with knows_fact_ids and withhold_fact_ids")
  } else {
    for (const key of ["knows_fact_ids", "withhold_fact_ids"] as const) {
      const v = ri[key]
      if (v === undefined) {
        errors.push(`reader_info.${key}: missing (array of canon fact IDs; [] allowed)`)
      } else if (!Array.isArray(v)) {
        errors.push(`reader_info.${key}: must be an array of canon fact IDs`)
      } else {
        v.forEach((id, i) => {
          if (!isNonblankString(id)) errors.push(`reader_info.${key}[${i}]: must be a nonblank string`)
          else if (!knownFactIds.has(id)) errors.push(`reader_info.${key}[${i}]: '${id}' not found in canon/facts.md`)
        })
      }
    }
    const knows = Array.isArray(ri.knows_fact_ids) ? ri.knows_fact_ids : []
    const withholds = Array.isArray(ri.withhold_fact_ids) ? ri.withhold_fact_ids : []
    const overlap = [...new Set(knows.filter(isNonblankString))].filter(id => withholds.includes(id))
    if (overlap.length > 0) {
      errors.push(`reader_info: knows_fact_ids and withhold_fact_ids overlap — withheld facts must not also be reader-known: ${overlap.join(", ")}`)
    }
  }

  return errors
}

/**
 * Throw when the plan's continuity contract is present but invalid.
 * Legacy plans (no contract keys) pass through and return null.
 */
export function assertContinuityContract(plan: PlanChapter, knownFactIds: ReadonlySet<string>): ContinuityContractV1 | null {
  const errors = validateContinuityContract(plan, knownFactIds)
  if (errors.length > 0) {
    throw new Error(`invalid continuity contract:\n  - ${errors.join("\n  - ")}`)
  }
  return hasContinuityContract(plan) ? (plan as unknown as ContinuityContractV1) : null
}

/**
 * Required mode for generated/new plans — call before writing a freshly
 * generated plan: the plan must carry a complete, valid version-1
 * continuity contract. Contractless (legacy) plans fail closed here.
 */
export function assertRequiredContinuityContract(plan: PlanChapter, knownFactIds: ReadonlySet<string>): ContinuityContractV1 {
  if (!hasContinuityContract(plan)) {
    throw new Error("continuity contract required for generated plans: none of continuity_contract_version/schedule_fact/continuity_anchors/reader_info present (legacy plans are readable, but new plans must pin a version-1 contract)")
  }
  return assertContinuityContract(plan, knownFactIds)
}

function ensureDir(path: string): void {
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export { ensureDir }

export function writePlan(novel: NovelDir, n: number, plan: PlanChapter): void {
  const path = novel.planPath(n)
  ensureDir(path)
  writeFileSync(path, stringify(plan), "utf-8")
}

export function readChapter(novel: NovelDir, n: number): string {
  const path = novel.chapterPath(n)
  if (!existsSync(path)) throw new Error(`no draft at ${path}`)
  return readFileSync(path, "utf-8")
}

export function writeChapter(novel: NovelDir, n: number, prose: string): void {
  ensureDir(novel.chapterPath(n))
  writeFileSync(novel.chapterPath(n), prose, "utf-8")
}
