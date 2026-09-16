import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { parse } from "yaml"
import { renderWriterBrief, validatePlanContinuity, type ContinuityContract } from "../src/loop/context"
import type { NovelDir, PlanChapter } from "../src/loop/novel"

/**
 * Phase-5 backlog item 2 (LESSONS L-2): the writer brief renders fact
 * continuity anchors, chapter-start character continuity anchors, and
 * reader-info state from the plan's version-1 continuity contract; legacy
 * plans stay readable with an honest unavailable marker.
 */

const CANON: NovelDir["canon"] = {
  "facts.md": [
    "# Facts",
    "",
    "- [world] [id=fact-1] The Guild's official record of the northern border shows 43 degrees.",
    "- [world] [id=fact-2] Master Therin died in the river after mapping the northern ford.",
    "- [history] [id=fact-3] The Guild Seal is required to bind survey appointments.",
    "- [character] [id=fact-4] Alory Vane is a journeyman surveyor.",
    "",
  ].join("\n"),
  "characters.md": [
    "## Alory Vane",
    "- Voice: precise, clipped",
    "- Drives: justice for Therin",
    "- Avoids: the Guild seal",
    "",
    "## Elara Venn",
    "- Voice: formal, measured",
    "- Drives: the Guild's standing",
    "- Avoids: the journal",
    "",
  ].join("\n"),
}

function basePlan(): PlanChapter {
  return {
    chapter: 1,
    title: "The Surveyor's Confession",
    pov: "Alory Vane",
    setting: "Guild tower room, Vellin",
    purpose: "test chapter",
    target_words: 800,
    characters_present: ["Alory Vane", "Elara Venn"],
    scenes: [
      {
        scene_id: "ch1-s1",
        beat_id: "b1",
        kind: "confrontation",
        description: "Alory confronts Elara over the bearing discrepancy.",
        characters: ["Alory Vane", "Elara Venn"],
        anchors: { temporal: "evening, three days after the ford survey", place: "Guild tower room, Vellin" },
        dramatic: { goal: "force an explanation", outcome: "Alory refuses" },
        endpoint: "Alory refuses",
        obligations: [{ text: "confrontation beat", obligation_id: "ch1-s1-o1" }],
        target_words: 400,
      },
      {
        scene_id: "ch1-s2",
        beat_id: "b2",
        kind: "confrontation",
        description: "Elara alone with the Guild seal.",
        characters: ["Elara Venn"],
        anchors: { place: "Guild tower room, Vellin" },
        dramatic: { goal: "offer the appointment" },
        endpoint: "Elara offers",
        target_words: 400,
      },
    ],
    facts_to_establish: ["fact-1"],
    knowledge_changes: [],
    character_state_changes: [],
  }
}

function baseContract(): ContinuityContract {
  return {
    continuity_contract_version: 1,
    schedule_fact: { fact_id: "schedule-ch1", text: "The marker sale is on the fourteenth day, at the contract bell." },
    continuity_anchors: {
      fact_ids: ["fact-1", "fact-2"],
      character_states: [
        {
          character: "Alory Vane",
          location: "Guild tower room",
          emotional: "resolved, afraid",
          knows: ["the Guild moved the boundary stone"],
          does_not_know: ["the Thornwood order"],
        },
        {
          character: "Elara Venn",
          location: "Guild tower room",
          emotional: "measured, guarded",
          knows: ["Alory's bearing reading"],
          does_not_know: [],
        },
      ],
    },
    reader_info: { knows_fact_ids: ["fact-1"], withhold_fact_ids: ["fact-2"] },
  }
}

function planWithContract(mutate?: (c: ContinuityContract) => void): PlanChapter {
  const contract = baseContract()
  mutate?.(contract)
  return { ...basePlan(), ...contract }
}

/** Slice the brief between two section headers (end header optional). */
function section(brief: string, header: string, endHeader?: string): string {
  const start = brief.indexOf(header)
  expect(start, `section header '${header}' missing`).toBeGreaterThanOrEqual(0)
  let end = brief.length
  if (endHeader !== undefined) {
    const next = brief.indexOf(endHeader, start + header.length)
    if (next >= 0) end = next
  }
  return brief.slice(start, end)
}

// ── validatePlanContinuity ────────────────────────────────────────────────

describe("validatePlanContinuity", () => {
  test("accepts a full version-1 contract (required or not)", () => {
    const plan = planWithContract()
    expect(validatePlanContinuity(plan, CANON, { required: true })).toEqual({
      ok: true,
      errors: [],
      contract: expect.objectContaining({ schedule_fact: expect.objectContaining({ fact_id: "schedule-ch1" }) }),
    })
    expect(validatePlanContinuity(plan, CANON, { required: false }).ok).toBe(true)
  })

  test("legacy plan (no contract fields) passes with required:false and fails with required:true", () => {
    const legacy = basePlan()
    const relaxed = validatePlanContinuity(legacy, CANON, { required: false })
    expect(relaxed).toEqual({ ok: true, errors: [], contract: null })
    const required = validatePlanContinuity(legacy, CANON, { required: true })
    expect(required.ok).toBe(false)
    expect(required.errors.join(" ")).toContain("must pin a continuity contract")
  })

  test("unknown fact id in continuity_anchors.fact_ids fails", () => {
    const plan = planWithContract(c => { c.continuity_anchors.fact_ids = ["fact-1", "fact-99"] })
    const res = validatePlanContinuity(plan, CANON, { required: false })
    expect(res.ok).toBe(false)
    expect(res.errors.join(" ")).toContain("unknown canon fact id 'fact-99'")
  })

  test("unknown fact id in reader_info fails", () => {
    const plan = planWithContract(c => { c.reader_info.knows_fact_ids = ["fact-40"] })
    const res = validatePlanContinuity(plan, CANON, { required: false })
    expect(res.ok).toBe(false)
    expect(res.errors.join(" ")).toContain("reader_info.knows_fact_ids references unknown canon fact id 'fact-40'")
  })

  test("reader knows/withhold overlap fails", () => {
    const plan = planWithContract(c => { c.reader_info = { knows_fact_ids: ["fact-1"], withhold_fact_ids: ["fact-1"] } })
    const res = validatePlanContinuity(plan, CANON, { required: false })
    expect(res.ok).toBe(false)
    expect(res.errors.join(" ")).toContain("appear in both knows_fact_ids and withhold_fact_ids")
  })

  test("missing schedule_fact fails (partial version-1)", () => {
    const plan = planWithContract()
    delete (plan as Record<string, unknown>).schedule_fact
    const res = validatePlanContinuity(plan, CANON, { required: false })
    expect(res.ok).toBe(false)
    expect(res.errors.join(" ")).toContain("schedule_fact must be an object")
  })

  test("missing reader_info fails (partial version-1)", () => {
    const plan = planWithContract()
    delete (plan as Record<string, unknown>).reader_info
    const res = validatePlanContinuity(plan, CANON, { required: false })
    expect(res.ok).toBe(false)
    expect(res.errors.join(" ")).toContain("reader_info must be an object")
  })

  test("wrong or missing version fails when any contract field is present", () => {
    const wrongVersion = planWithContract(c => { c.continuity_contract_version = 2 })
    expect(validatePlanContinuity(wrongVersion, CANON, { required: false }).ok).toBe(false)
    const noVersion = planWithContract()
    delete (noVersion as Record<string, unknown>).continuity_contract_version
    const res = validatePlanContinuity(noVersion, CANON, { required: false })
    expect(res.ok).toBe(false)
    expect(res.errors.join(" ")).toContain("continuity_contract_version must be 1")
  })

  test("blank required strings fail", () => {
    const blankText = planWithContract(c => { c.schedule_fact.text = "   " })
    expect(validatePlanContinuity(blankText, CANON, { required: false }).ok).toBe(false)
    const blankLoc = planWithContract(c => { c.continuity_anchors.character_states[0]!.location = "" })
    const res = validatePlanContinuity(blankLoc, CANON, { required: false })
    expect(res.ok).toBe(false)
    expect(res.errors.join(" ")).toContain("character_states[0].location must be a nonblank string")
  })

  test("malformed shapes fail (arrays, entries, objects)", () => {
    const factIdsString = planWithContract(c => { c.continuity_anchors.fact_ids = "fact-1" as unknown as string[] })
    expect(validatePlanContinuity(factIdsString, CANON, { required: false }).ok).toBe(false)

    const numericEntry = planWithContract(c => { c.continuity_anchors.fact_ids = ["fact-1", 42 as unknown as string] })
    const res = validatePlanContinuity(numericEntry, CANON, { required: false })
    expect(res.ok).toBe(false)
    expect(res.errors.join(" ")).toContain("entries must be nonblank strings")

    const statesString = planWithContract(c => { c.continuity_anchors.character_states = "nope" as unknown as ContinuityContract["continuity_anchors"]["character_states"] })
    expect(validatePlanContinuity(statesString, CANON, { required: false }).ok).toBe(false)

    const knowsString = planWithContract(c => { c.continuity_anchors.character_states[0]!.knows = "knows" as unknown as string[] })
    const res2 = validatePlanContinuity(knowsString, CANON, { required: false })
    expect(res2.ok).toBe(false)
    expect(res2.errors.join(" ")).toContain("character_states[0].knows must be an array of nonblank strings")
  })
})

// ── renderWriterBrief — version-1 contract ────────────────────────────────

describe("renderWriterBrief with a version-1 contract", () => {
  test("renders all sections in stable order", () => {
    const brief = renderWriterBrief(planWithContract(), CANON, 0)
    const order = [
      "WRITER DRAFTING BRIEF",
      "SCENE CONTRACT:",
      "OBLIGATIONS:",
      "FACT CONTINUITY ANCHORS:",
      "CONTINUITY ANCHORS:",
      "CHARACTERS:",
      "READER INFO STATE:",
      "READER KNOWS:",
      "WITHHOLD FROM READER:",
    ]
    for (let i = 0; i < order.length - 1; i++) {
      const a = brief.indexOf(order[i]!)
      const b = brief.indexOf(order[i + 1]!)
      expect(a, `section '${order[i]}' missing`).toBeGreaterThanOrEqual(0)
      expect(b, `section '${order[i + 1]}' missing`).toBeGreaterThanOrEqual(0)
      expect(a, `'${order[i]}' must precede '${order[i + 1]}'`).toBeLessThan(b)
    }
  })

  test("renders the schedule fact first, then canon facts with ids and resolved text", () => {
    const brief = renderWriterBrief(planWithContract(), CANON, 0)
    const anchors = section(brief, "FACT CONTINUITY ANCHORS:", "CONTINUITY ANCHORS:")
    expect(anchors).toContain("schedule: [id=schedule-ch1] The marker sale is on the fourteenth day, at the contract bell.")
    expect(anchors).toContain("- [id=fact-1] The Guild's official record of the northern border shows 43 degrees.")
    expect(anchors).toContain("- [id=fact-2] Master Therin died in the river after mapping the northern ford.")
    const schedulePos = anchors.indexOf("schedule:")
    const fact1Pos = anchors.indexOf("[id=fact-1]")
    expect(schedulePos).toBeGreaterThanOrEqual(0)
    expect(schedulePos).toBeLessThan(fact1Pos)
  })

  test("renders chapter-start character states with knows / does-not-know", () => {
    const brief = renderWriterBrief(planWithContract(), CANON, 0)
    const anchors = section(brief, "CONTINUITY ANCHORS:", "CHARACTERS:")
    expect(anchors).toContain("Alory Vane:")
    expect(anchors).toContain("location: Guild tower room")
    expect(anchors).toContain("emotional: resolved, afraid")
    expect(anchors).toContain("- the Guild moved the boundary stone")
    expect(anchors).toContain("- the Thornwood order")
    expect(anchors).toContain("Elara Venn:")
    expect(anchors).toContain("does not know: (none)")
  })

  test("filters continuity anchors to characters present in the scene", () => {
    const brief = renderWriterBrief(planWithContract(), CANON, 1) // scene 2: Elara only
    const anchors = section(brief, "CONTINUITY ANCHORS:", "READER INFO STATE:")
    expect(anchors).toContain("Elara Venn:")
    expect(anchors).not.toContain("Alory Vane")
  })

  test("reader knows/withhold render resolved facts in separate subsections", () => {
    const brief = renderWriterBrief(planWithContract(), CANON, 0)
    const knows = section(brief, "READER KNOWS:", "WITHHOLD FROM READER:")
    expect(knows).toContain("- [id=fact-1] The Guild's official record of the northern border shows 43 degrees.")
    expect(knows).not.toContain("fact-2")
    const withhold = section(brief, "WITHHOLD FROM READER:")
    expect(withhold).toContain("- [id=fact-2] Master Therin died in the river after mapping the northern ford.")
    expect(withhold).not.toContain("fact-1]")
  })

  test("empty lists render an honest (none) instead of disappearing", () => {
    const brief = renderWriterBrief(planWithContract(c => {
      c.continuity_anchors.fact_ids = []
      c.continuity_anchors.character_states = [
        { character: "Alory Vane", location: "Guild tower room", emotional: "wary", knows: [], does_not_know: [] },
      ]
      c.reader_info = { knows_fact_ids: [], withhold_fact_ids: [] }
    }), CANON, 0)
    const anchors = section(brief, "FACT CONTINUITY ANCHORS:", "CONTINUITY ANCHORS:")
    expect(anchors).toContain("schedule: [id=schedule-ch1]")
    expect(anchors).toContain("(none)")
    const states = section(brief, "CONTINUITY ANCHORS:", "CHARACTERS:")
    expect(states).toContain("Alory Vane:")
    expect(states).toContain("knows: (none)")
    expect(states).toContain("does not know: (none)")
    const reader = section(brief, "READER INFO STATE:")
    expect(reader).toContain("READER KNOWS:")
    expect(reader).toContain("WITHHOLD FROM READER:")
    expect(reader.match(/\(none\)/g)).toHaveLength(2)
  })

  test("no character present in the scene renders (none) for continuity anchors", () => {
    const brief = renderWriterBrief(planWithContract(c => {
      c.continuity_anchors.character_states = [
        { character: "Tessa Mire", location: "the ford", emotional: "calm", knows: [], does_not_know: [] },
      ]
    }), CANON, 0)
    const states = section(brief, "CONTINUITY ANCHORS:", "CHARACTERS:")
    expect(states).toContain("(none)")
    expect(states).not.toContain("Tessa Mire")
  })

  test("throws (fail closed) on a partial/invalid version-1 plan", () => {
    const partial = planWithContract()
    delete (partial as Record<string, unknown>).reader_info
    expect(() => renderWriterBrief(partial, CANON, 0)).toThrow(/invalid continuity contract/)
    const unknownId = planWithContract(c => { c.reader_info.withhold_fact_ids = ["fact-99"] })
    expect(() => renderWriterBrief(unknownId, CANON, 0)).toThrow(/unknown canon fact id 'fact-99'/)
  })
})

// ── renderWriterBrief — legacy compatibility ──────────────────────────────

const LEGACY_MARKER = "CONTINUITY: (legacy plan — no continuity contract; continuity anchors and reader-info state unavailable)"

describe("renderWriterBrief with legacy plans (no continuity contract)", () => {
  test("renders a concise legacy marker in the continuity slot, without continuity sections", () => {
    const brief = renderWriterBrief(basePlan(), CANON, 0)
    expect(brief).toContain(LEGACY_MARKER)
    expect(brief).not.toContain("FACT CONTINUITY ANCHORS:")
    expect(brief).not.toContain("CONTINUITY ANCHORS:")
    expect(brief).not.toContain("READER INFO STATE:")
    // Marker sits between obligations and characters (stable order preserved).
    const obligPos = brief.indexOf("OBLIGATIONS:")
    const markerPos = brief.indexOf(LEGACY_MARKER)
    const charsPos = brief.indexOf("CHARACTERS:")
    expect(obligPos).toBeLessThan(markerPos)
    expect(markerPos).toBeLessThan(charsPos)
  })

  function loadFixtureNovel(relDir: string): { plan: PlanChapter; canon: NovelDir["canon"] } {
    const base = resolve(import.meta.dir, relDir)
    const canon: NovelDir["canon"] = {}
    for (const f of readdirSync(join(base, "canon")).filter(f => f.endsWith(".md")).sort()) {
      canon[f] = readFileSync(join(base, "canon", f), "utf-8")
    }
    const plan = parse(readFileSync(join(base, "plan", "ch01.yaml"), "utf-8")) as PlanChapter
    return { plan, canon }
  }

  test("existing Rillgate ch1 plan artifact still renders (legacy, all scenes)", () => {
    const { plan, canon } = loadFixtureNovel("../novels/rillgate")
    expect(validatePlanContinuity(plan, canon, { required: false }).ok).toBe(true)
    for (let i = 0; i < plan.scenes.length; i++) {
      const brief = renderWriterBrief(plan, canon, i)
      expect(brief).toContain(LEGACY_MARKER)
      expect(brief).not.toContain("FACT CONTINUITY ANCHORS:")
      expect(brief).not.toContain("READER INFO STATE:")
    }
  })

  test("loop-dry fixture plan still renders (legacy, all scenes)", () => {
    const { plan, canon } = loadFixtureNovel("./fixtures/loop-dry")
    expect(validatePlanContinuity(plan, canon, { required: false }).ok).toBe(true)
    for (let i = 0; i < plan.scenes.length; i++) {
      const brief = renderWriterBrief(plan, canon, i)
      expect(brief).toContain(LEGACY_MARKER)
    }
  })
})
