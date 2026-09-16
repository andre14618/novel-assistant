import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { renderWriterBrief } from "../src/loop/context"
import { openNovel, readPlan, type NovelDir, type PlanChapter } from "../src/loop/novel"

/**
 * Per-novel genre/tone file (novels/<name>/style.md) rendered into the writer
 * drafting brief as a stable STYLE: section (writer-brief.md step 4). The
 * section sits after the WRITER DRAFTING BRIEF header block and before
 * SCENE CONTRACT, for every scene. Absence of style.md means no section at
 * all — honest absence, no fallback to the era primer, and a byte-identical
 * brief to the pre-change output.
 */

const STYLE_NOVEL = "./fixtures/style-novel"
const NO_STYLE_NOVEL = "./fixtures/loop-dry"
const GOLDEN = "./fixtures/writer-brief-nostyle.loop-dry.golden"

const STYLE_MD = readFileSync(resolve(import.meta.dir, STYLE_NOVEL, "style.md"), "utf-8")

function loadNovel(rel: string): { novel: NovelDir; plan: PlanChapter } {
  const novel = openNovel(resolve(import.meta.dir, rel))
  const plan = readPlan(novel, 1)
  return { novel, plan }
}

/** Position of a section header at the start of its line. */
function headerPos(brief: string, header: string): number {
  const re = new RegExp(`^\\s*${header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m")
  const m = brief.match(re)
  return m ? m.index! : -1
}

// ── novel loader ──────────────────────────────────────────────────────────

describe("novel loader — style.md", () => {
  test("openNovel reads style.md into novel.style (exact content)", () => {
    const { novel } = loadNovel(STYLE_NOVEL)
    expect(novel.style).toBe(STYLE_MD)
  })

  test("a novel without style.md has novel.style === null", () => {
    const { novel } = loadNovel(NO_STYLE_NOVEL)
    expect(novel.style).toBeNull()
  })
})

// ── STYLE section present ─────────────────────────────────────────────────

describe("renderWriterBrief — STYLE section (style.md present)", () => {
  test("renders the exact style.md content in a STYLE: block, for every scene", () => {
    const { novel, plan } = loadNovel(STYLE_NOVEL)
    const trimmed = STYLE_MD.trim()
    for (let i = 0; i < plan.scenes.length; i++) {
      const brief = renderWriterBrief(plan, novel.canon, i, novel.style)
      expect(brief).toContain("STYLE:")
      // the exact content of the test-novel style.md is present verbatim
      expect(brief).toContain("STYLE:\n" + trimmed)
    }
  })

  test("STYLE sits after the header block and before SCENE CONTRACT (every scene)", () => {
    const { novel, plan } = loadNovel(STYLE_NOVEL)
    for (let i = 0; i < plan.scenes.length; i++) {
      const brief = renderWriterBrief(plan, novel.canon, i, novel.style)
      const titlePos = brief.indexOf("WRITER DRAFTING BRIEF")
      const charsPos = brief.indexOf("Characters present:")
      const stylePos = headerPos(brief, "STYLE:")
      const contractPos = headerPos(brief, "SCENE CONTRACT:")
      expect(titlePos).toBeGreaterThanOrEqual(0)
      expect(stylePos).toBeGreaterThanOrEqual(0)
      expect(contractPos).toBeGreaterThanOrEqual(0)
      expect(stylePos, "STYLE after the header block").toBeGreaterThan(charsPos)
      expect(stylePos, "STYLE before SCENE CONTRACT").toBeLessThan(contractPos)
    }
  })

  test("STYLE is emitted exactly once per scene", () => {
    const { novel, plan } = loadNovel(STYLE_NOVEL)
    for (let i = 0; i < plan.scenes.length; i++) {
      const brief = renderWriterBrief(plan, novel.canon, i, novel.style)
      expect(brief.match(/^STYLE:$/gm)).toHaveLength(1)
    }
  })
})

// ── honest absence ────────────────────────────────────────────────────────

describe("renderWriterBrief — no style.md (honest absence)", () => {
  test("no STYLE section, no fabricated or empty section", () => {
    const { novel, plan } = loadNovel(NO_STYLE_NOVEL)
    for (let i = 0; i < plan.scenes.length; i++) {
      const brief = renderWriterBrief(plan, novel.canon, i, novel.style)
      expect(brief).not.toContain("STYLE:")
    }
  })

  test("no-style output is byte-identical to the pre-change brief (golden)", () => {
    const { novel, plan } = loadNovel(NO_STYLE_NOVEL)
    const parts: string[] = []
    for (let i = 0; i < plan.scenes.length; i++) {
      parts.push(`===== SCENE ${i} =====\n` + renderWriterBrief(plan, novel.canon, i, novel.style))
    }
    const actual = parts.join("\n")
    const golden = readFileSync(resolve(import.meta.dir, GOLDEN), "utf-8")
    expect(actual).toBe(golden)
  })

  test("empty/blank style renders no STYLE section (no fallback)", () => {
    const { novel, plan } = loadNovel(NO_STYLE_NOVEL)
    for (const style of [undefined, null, "", "   ", "\n\n"]) {
      const brief = renderWriterBrief(plan, novel.canon, 0, style)
      expect(brief).not.toContain("STYLE:")
    }
  })
})

// ── rillgate ──────────────────────────────────────────────────────────────

describe("rillgate style.md", () => {
  test("is loaded and carries the mercenary-progression lane, rendered in the brief", () => {
    const { novel, plan } = loadNovel("../novels/rillgate")
    expect(novel.style).not.toBeNull()
    expect(novel.style!).toContain("mercenary-progression adventure")
    const brief = renderWriterBrief(plan, novel.canon, 0, novel.style)
    expect(brief).toContain("STYLE:")
    expect(brief).toContain("mercenary-progression adventure")
  })
})
