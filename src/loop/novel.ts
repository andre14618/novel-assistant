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
  return parse(readFileSync(path, "utf-8")) as PlanChapter
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
