import { afterAll, describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { stringify } from "yaml"
import {
  assertContinuityContract,
  assertRequiredContinuityContract,
  canonFactIds,
  extractFactIds,
  hasContinuityContract,
  openNovel,
  readPlan,
  validateContinuityContract,
  type CharacterStateAnchor,
  type NovelDir,
  type PlanChapter,
} from "../src/loop/novel"
import { renderPlannerSystem } from "../src/loop/context"

/**
 * Focused tests: plan continuity contract (phase 5 backlog 2, LESSONS L-2).
 * Covers the versioned types + validator in src/loop/novel.ts: required
 * mode, legacy compatibility, complete valid data, partial/malformed
 * fields, unknown fact IDs, reader knows/withhold overlap, useful errors,
 * and readPlan fail-closed behavior on disk (incl. existing fixtures).
 */

const CANON_FACTS_MD = [
  "# Facts",
  "",
  "- [world] [id=fact-1] Mira's marker is sold on the fourteenth day.",
  "- [world] [id=fact-2] The bell marks the deadline.",
  "- [character] [id=fact-3] Kael Rusk is unranked.",
  "",
].join("\n")
const CANON: NovelDir["canon"] = { "facts.md": CANON_FACTS_MD }

function validPlan(): PlanChapter {
  return {
    chapter: 2,
    title: "The Bell",
    pov: "Kael Rusk",
    setting: "Contract Hall",
    purpose: "Pin the sale date and keep the Thornwood order withheld.",
    target_words: 2000,
    characters_present: ["Kael Rusk"],
    scenes: [{ description: "Kael waits for the bell", characters: ["Kael Rusk"] }],
    facts_to_establish: ["schedule-ch2"],
    knowledge_changes: [],
    character_state_changes: [],
    continuity_contract_version: 1,
    schedule_fact: {
      fact_id: "schedule-ch2",
      text: "Mira's marker is sold on the fourteenth day, at the contract bell.",
    },
    continuity_anchors: {
      fact_ids: ["fact-1", "fact-2"],
      character_states: [
        {
          character: "Kael Rusk",
          location: "Contract Hall",
          emotional: "wary",
          knows: ["the posting board"],
          does_not_know: ["the fourteenth-day sale"],
        },
      ],
    },
    reader_info: { knows_fact_ids: ["fact-1"], withhold_fact_ids: ["fact-3"] },
  }
}

function legacyPlan(): PlanChapter {
  return {
    chapter: 1,
    title: "Legacy",
    pov: "Kael Rusk",
    setting: "Contract Hall",
    purpose: "A plan written before the continuity contract existed.",
    target_words: 1000,
    characters_present: ["Kael Rusk"],
    scenes: [{ description: "legacy scene", characters: ["Kael Rusk"] }],
    facts_to_establish: [],
    knowledge_changes: [],
    character_state_changes: [],
  }
}

describe("planner prompt", () => {
  test("uses the beat-level YAML contract without the contradictory whole-arc shape", () => {
    const system = renderPlannerSystem()
    expect(system).toContain("continuity_contract_version: 1")
    expect(system).toContain("only one valid YAML document")
    expect(system).not.toContain('"chapters"')
    expect(system).not.toContain("Do NOT include `scenes`")
  })
})

describe("validateContinuityContract — complete valid data", () => {
  test("accepts a complete version-1 contract with resolvable fact IDs", () => {
    const plan = validPlan()
    expect(hasContinuityContract(plan)).toBe(true)
    expect(validateContinuityContract(plan, CANON)).toEqual([])
    const contract = assertContinuityContract(plan, CANON)
    expect(contract).not.toBeNull()
    expect(contract!.schedule_fact.fact_id).toBe("schedule-ch2")
    expect(contract!.reader_info.withhold_fact_ids).toEqual(["fact-3"])
  })

  test("accepts empty anchor/reader lists (shape-valid, render as (none))", () => {
    const plan = validPlan()
    plan.continuity_anchors.fact_ids = []
    plan.continuity_anchors.character_states = []
    plan.reader_info = { knows_fact_ids: [], withhold_fact_ids: [] }
    expect(validateContinuityContract(plan, CANON)).toEqual([])
  })
})

describe("validateContinuityContract — legacy compatibility", () => {
  test("a wholly legacy plan (no contract fields) is readable and unvalidated", () => {
    const plan = legacyPlan()
    expect(hasContinuityContract(plan)).toBe(false)
    expect(validateContinuityContract(plan, CANON)).toEqual([])
    expect(assertContinuityContract(plan, CANON)).toBeNull()
  })

  test("legacy plans stay readable even with an empty canon", () => {
    expect(validateContinuityContract(legacyPlan(), {})).toEqual([])
  })
})

describe("validateContinuityContract — unknown fact IDs", () => {
  test("rejects an unknown ID in continuity_anchors.fact_ids", () => {
    const plan = validPlan()
    plan.continuity_anchors.fact_ids = ["fact-1", "fact-99"]
    const errors = validateContinuityContract(plan, CANON)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/continuity_anchors\.fact_ids\[1\]/)
    expect(errors[0]).toMatch(/'fact-99' not found in canon\/facts\.md/)
  })

  test("rejects an unknown ID in reader_info.knows_fact_ids", () => {
    const plan = validPlan()
    plan.reader_info.knows_fact_ids = ["fact-77"]
    const errors = validateContinuityContract(plan, CANON)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/reader_info\.knows_fact_ids\[0\]/)
    expect(errors[0]).toMatch(/'fact-77' not found in canon\/facts\.md/)
  })

  test("rejects an unknown ID in reader_info.withhold_fact_ids", () => {
    const plan = validPlan()
    plan.reader_info.withhold_fact_ids = ["fact-88"]
    const errors = validateContinuityContract(plan, CANON)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/reader_info\.withhold_fact_ids\[0\]/)
    expect(errors[0]).toMatch(/'fact-88' not found in canon\/facts\.md/)
  })

  test("schedule_fact.fact_id is plan-local (not resolved against canon)", () => {
    // The schedule fact is established BY this chapter; its ID is not in
    // canon yet and must not be rejected.
    expect(validateContinuityContract(validPlan(), CANON)).toEqual([])
  })
})

describe("validateContinuityContract — reader knows/withhold overlap", () => {
  test("rejects a fact that is both reader-known and withheld", () => {
    const plan = validPlan()
    plan.reader_info = { knows_fact_ids: ["fact-1", "fact-2"], withhold_fact_ids: ["fact-2", "fact-3"] }
    const errors = validateContinuityContract(plan, CANON)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/knows_fact_ids and withhold_fact_ids overlap/)
    expect(errors[0]).toMatch(/fact-2/)
  })

  test("disjoint knows/withhold lists produce no overlap error", () => {
    const plan = validPlan()
    plan.reader_info = { knows_fact_ids: ["fact-1"], withhold_fact_ids: ["fact-2", "fact-3"] }
    expect(validateContinuityContract(plan, CANON)).toEqual([])
  })
})

describe("validateContinuityContract — missing/partial version-1 contract", () => {
  test("any single contract field opts the whole contract in", () => {
    const plan = legacyPlan()
    plan.reader_info = { knows_fact_ids: [], withhold_fact_ids: [] }
    const errors = validateContinuityContract(plan, CANON)
    expect(errors.some(e => e.startsWith("continuity_contract_version missing"))).toBe(true)
    expect(errors.some(e => e.startsWith("schedule_fact missing"))).toBe(true)
    expect(errors.some(e => e.startsWith("continuity_anchors missing"))).toBe(true)
  })

  test("version + schedule_fact alone is partial — anchors and reader_info required", () => {
    const plan = legacyPlan()
    plan.continuity_contract_version = 1
    plan.schedule_fact = { fact_id: "schedule-ch2", text: "The sale is on the fourteenth day." }
    const errors = validateContinuityContract(plan, CANON)
    expect(errors.some(e => e.startsWith("continuity_anchors missing"))).toBe(true)
    expect(errors.some(e => e.startsWith("reader_info missing"))).toBe(true)
  })

  test("rejects an unsupported version number", () => {
    const plan = validPlan()
    plan.continuity_contract_version = 2
    const errors = validateContinuityContract(plan, CANON)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/unsupported version 2 \(supported: 1\)/)
  })

  test("rejects a string version (fail closed, not coerced)", () => {
    const plan = validPlan()
    plan.continuity_contract_version = "1" as unknown as number
    const errors = validateContinuityContract(plan, CANON)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/unsupported version "1"/)
  })

  test("collects multiple errors at once (all surfaces, not first-fail)", () => {
    const plan = validPlan()
    delete plan.continuity_contract_version
    plan.schedule_fact.text = "   "
    plan.continuity_anchors.fact_ids = ["fact-99"]
    plan.reader_info = { knows_fact_ids: ["fact-1"], withhold_fact_ids: ["fact-1"] }
    const errors = validateContinuityContract(plan, CANON)
    expect(errors.length).toBeGreaterThanOrEqual(4)
    expect(errors.some(e => e.startsWith("continuity_contract_version missing"))).toBe(true)
    expect(errors.some(e => e.includes("schedule_fact.text"))).toBe(true)
    expect(errors.some(e => e.includes("fact-99"))).toBe(true)
    expect(errors.some(e => e.includes("overlap"))).toBe(true)
  })
})

describe("validateContinuityContract — malformed fields", () => {
  test("schedule_fact must be a mapping with nonblank fact_id and text", () => {
    const plan = validPlan()
    plan.schedule_fact = "the fourteenth day" as unknown as PlanChapter["schedule_fact"]
    expect(validateContinuityContract(plan, CANON).some(e => e.includes("schedule_fact: must be a mapping"))).toBe(true)

    const plan2 = validPlan()
    plan2.schedule_fact = null as unknown as PlanChapter["schedule_fact"]
    expect(validateContinuityContract(plan2, CANON).some(e => e.includes("schedule_fact: must be a mapping"))).toBe(true)

    const plan3 = validPlan()
    plan3.schedule_fact = { fact_id: "  ", text: "ok" }
    expect(validateContinuityContract(plan3, CANON).some(e => e.startsWith("schedule_fact.fact_id: must be a nonblank plan-local trace ID"))).toBe(true)

    const plan4 = validPlan()
    delete (plan4.schedule_fact as Record<string, unknown>).text
    expect(validateContinuityContract(plan4, CANON).some(e => e.startsWith("schedule_fact.text: must be a nonblank string"))).toBe(true)
  })

  test("continuity_anchors.fact_ids must be an array of nonblank canon IDs", () => {
    const plan = validPlan()
    plan.continuity_anchors.fact_ids = "fact-1" as unknown as string[]
    expect(validateContinuityContract(plan, CANON).some(e => e.includes("continuity_anchors.fact_ids: must be an array"))).toBe(true)

    const plan2 = validPlan()
    plan2.continuity_anchors.fact_ids = ["fact-1", ""]
    expect(validateContinuityContract(plan2, CANON).some(e => e.includes("continuity_anchors.fact_ids[1]: must be a nonblank string"))).toBe(true)

    const plan3 = validPlan()
    delete (plan3.continuity_anchors as Record<string, unknown>).fact_ids
    expect(validateContinuityContract(plan3, CANON).some(e => e.includes("continuity_anchors.fact_ids: missing"))).toBe(true)
  })

  test("character_states entries need nonblank character/location/emotional and string arrays", () => {
    const plan = validPlan()
    plan.continuity_anchors.character_states = ["Kael Rusk"] as unknown as CharacterStateAnchor[]
    expect(validateContinuityContract(plan, CANON).some(e => e.includes("character_states[0]: must be a mapping"))).toBe(true)

    const plan2 = validPlan()
    plan2.continuity_anchors.character_states = [{ character: "Kael Rusk", location: "Hall" }] as unknown as CharacterStateAnchor[]
    const errors2 = validateContinuityContract(plan2, CANON)
    expect(errors2.some(e => e.includes("character_states[0].emotional: must be a nonblank string"))).toBe(true)
    expect(errors2.some(e => e.includes("character_states[0].knows: missing"))).toBe(true)
    expect(errors2.some(e => e.includes("character_states[0].does_not_know: missing"))).toBe(true)

    const plan3 = validPlan()
    plan3.continuity_anchors.character_states = [
      { character: "Kael Rusk", location: "Hall", emotional: "wary", knows: "the board", does_not_know: [] },
    ] as unknown as CharacterStateAnchor[]
    expect(validateContinuityContract(plan3, CANON).some(e => e.includes("character_states[0].knows: must be an array of nonblank strings"))).toBe(true)

    const plan4 = validPlan()
    plan4.continuity_anchors.character_states = [
      { character: "Kael Rusk", location: "Hall", emotional: "wary", knows: [123], does_not_know: [] },
    ] as unknown as CharacterStateAnchor[]
    expect(validateContinuityContract(plan4, CANON).some(e => e.includes("character_states[0].knows: must be an array of nonblank strings"))).toBe(true)
  })

  test("reader_info must be a mapping with both ID arrays present", () => {
    const plan = validPlan()
    plan.reader_info = null as unknown as PlanChapter["reader_info"]
    expect(validateContinuityContract(plan, CANON).some(e => e.includes("reader_info: must be a mapping"))).toBe(true)

    const plan2 = validPlan()
    delete (plan2.reader_info as Record<string, unknown>).knows_fact_ids
    expect(validateContinuityContract(plan2, CANON).some(e => e.includes("reader_info.knows_fact_ids: missing"))).toBe(true)

    const plan3 = validPlan()
    plan3.reader_info.withhold_fact_ids = "fact-2" as unknown as string[]
    expect(validateContinuityContract(plan3, CANON).some(e => e.includes("reader_info.withhold_fact_ids: must be an array"))).toBe(true)
  })
})

describe("validateContinuityContract — duplicate IDs", () => {
  test("rejects a fact ID listed twice in continuity_anchors.fact_ids", () => {
    const plan = validPlan()
    plan.continuity_anchors.fact_ids = ["fact-1", "fact-1"]
    const errors = validateContinuityContract(plan, CANON)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/continuity_anchors\.fact_ids\[1\]: 'fact-1' is listed more than once/)
  })

  test("rejects a fact ID listed twice in reader_info.knows_fact_ids", () => {
    const plan = validPlan()
    plan.reader_info.knows_fact_ids = ["fact-1", "fact-1"]
    const errors = validateContinuityContract(plan, CANON)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/reader_info\.knows_fact_ids\[1\]: 'fact-1' is listed more than once/)
  })

  test("rejects a fact ID listed twice in reader_info.withhold_fact_ids", () => {
    const plan = validPlan()
    plan.reader_info.withhold_fact_ids = ["fact-2", "fact-2"]
    const errors = validateContinuityContract(plan, CANON)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/reader_info\.withhold_fact_ids\[1\]: 'fact-2' is listed more than once/)
  })

  test("rejects duplicate character anchors (case-insensitive)", () => {
    const plan = validPlan()
    plan.continuity_anchors.character_states = [
      { character: "Kael Rusk", location: "Contract Hall", emotional: "wary", knows: [], does_not_know: [] },
      { character: "KAEL RUSK", location: "Contract Hall", emotional: "calm", knows: [], does_not_know: [] },
    ]
    const errors = validateContinuityContract(plan, CANON)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/character_states\[1\]: character 'KAEL RUSK' is already anchored \(case-insensitive duplicate\)/)
  })

  test("same character spelled identically twice is also rejected", () => {
    const plan = validPlan()
    plan.continuity_anchors.character_states = [
      { character: "Kael Rusk", location: "Contract Hall", emotional: "wary", knows: [], does_not_know: [] },
      { character: "Kael Rusk", location: "Contract Hall", emotional: "calm", knows: [], does_not_know: [] },
    ]
    expect(validateContinuityContract(plan, CANON).some(e => e.includes("already anchored"))).toBe(true)
  })

  test("distinct characters (any casing) are accepted", () => {
    const plan = validPlan()
    plan.continuity_anchors.character_states = [
      { character: "Kael Rusk", location: "Contract Hall", emotional: "wary", knows: [], does_not_know: [] },
      { character: "Mira", location: "the market", emotional: "hasty", knows: [], does_not_know: [] },
    ]
    expect(validateContinuityContract(plan, CANON)).toEqual([])
  })

  test("rejects canon with the same explicit fact ID on two rows", () => {
    const dupCanon: NovelDir["canon"] = {
      "facts.md": [
        "- [world] [id=fact-1] first row",
        "- [world] [id=fact-1] second row",
        "",
      ].join("\n"),
    }
    const errors = validateContinuityContract(validPlan(), dupCanon)
    expect(errors.some(e => e.includes("canon/facts.md: fact id 'fact-1' appears on multiple rows"))).toBe(true)
  })

  test("rejects canon where an explicit ID collides with an implicit fact-N", () => {
    const dupCanon: NovelDir["canon"] = {
      "facts.md": [
        "- [world] untagged row gets implicit fact-1",
        "- [world] [id=fact-1] explicit row collides with it",
        "",
      ].join("\n"),
    }
    const errors = validateContinuityContract(validPlan(), dupCanon)
    expect(errors.some(e => e.includes("canon/facts.md: fact id 'fact-1' appears on multiple rows"))).toBe(true)
  })
})

describe("required mode (generated plans)", () => {
  test("accepts a complete valid contract and returns it", () => {
    const contract = assertRequiredContinuityContract(validPlan(), CANON)
    expect(contract.continuity_contract_version).toBe(1)
    expect(contract.schedule_fact.text).toContain("fourteenth day")
  })

  test("fails closed on a contractless (legacy) plan", () => {
    expect(() => assertRequiredContinuityContract(legacyPlan(), CANON)).toThrow(
      /continuity contract required for generated plans/,
    )
  })

  test("fails closed on a partial contract with useful errors", () => {
    const plan = legacyPlan()
    plan.continuity_contract_version = 1
    plan.schedule_fact = { fact_id: "schedule-ch2", text: "The sale is on the fourteenth day." }
    expect(() => assertRequiredContinuityContract(plan, CANON)).toThrow(/invalid continuity contract/)
    expect(() => assertRequiredContinuityContract(plan, CANON)).toThrow(/continuity_anchors missing/)
    expect(() => assertRequiredContinuityContract(plan, CANON)).toThrow(/reader_info missing/)
  })

  test("fails closed on unknown fact IDs", () => {
    const plan = validPlan()
    plan.continuity_anchors.fact_ids = ["fact-99"]
    expect(() => assertRequiredContinuityContract(plan, CANON)).toThrow(/'fact-99' not found in canon\/facts\.md/)
  })
})

describe("fact ID extraction", () => {
  test("extracts explicit IDs and implicit fact-N for untagged rows (parseFacts numbering)", () => {
    // Implicit IDs count all fact rows seen so far (explicit + implicit),
    // exactly mirroring parseFacts in src/loop/context.ts.
    const md = [
      "- [world] [id=fact-9] tagged row",
      "- [world] untagged row",
      "- [place] [id=fact-10] tagged again",
      "- not a fact row",
      "",
    ].join("\n")
    expect(extractFactIds(md)).toEqual(["fact-9", "fact-2", "fact-10"])
  })

  test("canonFactIds reads canon/facts.md from the novel dir", () => {
    const ids = canonFactIds({ "facts.md": CANON_FACTS_MD })
    expect([...ids].sort()).toEqual(["fact-1", "fact-2", "fact-3"])
    expect(canonFactIds({})).toEqual(new Set())
  })
})

describe("readPlan — file-level fail-closed behavior", () => {
  const tmp = mkdtempSync(join(tmpdir(), "plan-continuity-"))
  afterAll(() => rmSync(tmp, { recursive: true, force: true }))

  function makeNovel(name: string): string {
    const base = join(tmp, name)
    mkdirSync(join(base, "canon"), { recursive: true })
    mkdirSync(join(base, "plan"), { recursive: true })
    writeFileSync(join(base, "canon", "facts.md"), CANON_FACTS_MD)
    return base
  }

  function writePlan(base: string, n: number, plan: PlanChapter): void {
    writeFileSync(join(base, "plan", `ch${String(n).padStart(2, "0")}.yaml`), stringify(plan), "utf-8")
  }

  test("reads a wholly legacy plan without validation", () => {
    const base = makeNovel("legacy-novel")
    writePlan(base, 1, legacyPlan())
    const plan = readPlan(openNovel(base), 1)
    expect(plan.chapter).toBe(1)
    expect(hasContinuityContract(plan)).toBe(false)
  })

  test("reads a valid opted-in plan", () => {
    const base = makeNovel("valid-novel")
    writePlan(base, 1, validPlan())
    const plan = readPlan(openNovel(base), 1)
    expect(plan.continuity_contract_version).toBe(1)
    expect(plan.reader_info?.withhold_fact_ids).toEqual(["fact-3"])
  })

  test("throws on a partial version-1 plan on disk (never silently accepted)", () => {
    const base = makeNovel("partial-novel")
    const plan = legacyPlan()
    plan.continuity_contract_version = 1
    plan.schedule_fact = { fact_id: "schedule-ch1", text: "The sale is on the fourteenth day." }
    writePlan(base, 1, plan)
    expect(() => readPlan(openNovel(base), 1)).toThrow(/invalid continuity contract/)
    expect(() => readPlan(openNovel(base), 1)).toThrow(/reader_info missing/)
  })

  test("throws on an opted-in plan with an unknown fact ID", () => {
    const base = makeNovel("unknown-novel")
    const plan = validPlan()
    plan.reader_info.knows_fact_ids = ["fact-99"]
    writePlan(base, 1, plan)
    expect(() => readPlan(openNovel(base), 1)).toThrow(/'fact-99' not found in canon\/facts\.md/)
  })

  test("throws on an opted-in plan with knows/withhold overlap", () => {
    const base = makeNovel("overlap-novel")
    const plan = validPlan()
    plan.reader_info = { knows_fact_ids: ["fact-1"], withhold_fact_ids: ["fact-1"] }
    writePlan(base, 1, plan)
    expect(() => readPlan(openNovel(base), 1)).toThrow(/overlap/)
  })

  test("rillgate ch1 stays readable (legacy, no contract)", () => {
    const rillgate = openNovel("novels/rillgate")
    const rillPlan = readPlan(rillgate, 1)
    expect(rillPlan.chapter).toBe(1)
    expect(hasContinuityContract(rillPlan)).toBe(false)
  })

  test("loop-dry fixture plan is on v1 and reads with a valid contract", () => {
    const dry = openNovel("tests/fixtures/loop-dry")
    const dryPlan = readPlan(dry, 1)
    expect(dryPlan.chapter).toBe(1)
    expect(hasContinuityContract(dryPlan)).toBe(true)
    expect(dryPlan.continuity_contract_version).toBe(1)
    expect(dryPlan.schedule_fact?.fact_id).toBe("schedule-ch01")
  })
})
