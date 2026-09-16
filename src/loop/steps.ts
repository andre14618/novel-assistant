import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { callLLM, callAgent } from "../llm"
import { validateChapterDraft, type ChapterOutlineLike } from "../../checks/validation"
import { detectProseIntegrityIssues } from "../../checks/integrity"
import { detectSyncDefects } from "../../checks/quality"
import { readPlan, readChapter, writeChapter, writeState, readState, openNovel, ensureDir, type NovelDir, type PlanChapter } from "./novel"
import { renderPlannerContext, renderWriterBrief, renderReviewerContext, readPrompt, validatePlanContinuity } from "./context"
import { ReviewSchema, type ReviewResult } from "./review-schema"
import { extractJSON } from "../llm"

/** Writer responses are JSON-encoded per prose-writer-system.md ({"prose": ...}).
 *  Falls back to raw content if the model returns plain text. */
export function extractWriterProse(content: string): string {
  try {
    const parsed = JSON.parse(extractJSON(content)) as Record<string, unknown>
    if (typeof parsed.prose === "string" && parsed.prose.trim().length > 0) return parsed.prose
  } catch { /* not JSON — fall through */ }
  return content
}

/**
 * src/loop/steps.ts — the six loop steps (AGENTS.md loop protocol).
 * One pi session per chapter; this module executes the steps over files.
 */

export interface StepOptions {
  dry: boolean
  sessionId: string
  maxFixPasses: number
  forceReview?: boolean
}

// ── 1. Plan ────────────────────────────────────────────────────────────────
export async function planStep(novel: NovelDir, n: number, opts: StepOptions): Promise<PlanChapter> {
  const planPath = novel.planPath(n)
  if (opts.dry) {
    if (existsSync(planPath)) {
      console.log(`[LOOP] plan: using existing ${planPath} (dry)`)
      return readPlan(novel, n)
    }
    throw new Error(`dry plan step: ${planPath} does not exist`)
  }

  const system = [
    readPrompt("planner-contract.md"),
    "",
    readPrompt("planner/chapter-outline-system.md"),
  ].join("\n\n")
  const user = renderPlannerContext(novel, n)
  const outcome = await callLLM({
    agent: "planner",
    systemPrompt: system,
    userPrompt: user,
    responseFormat: "text",
    thinking: true,
    chapter: n,
    sessionId: opts.sessionId,
    maxTokens: 8192,
  })
  const { stringify } = await import("yaml")
  const plan = (await import("yaml")).parse(outcome.content) as PlanChapter
  // Fail closed before write: generated plans must pin a fully valid
  // version-1 continuity contract (phase-5 backlog item 2, LESSONS L-2).
  const continuity = validatePlanContinuity(plan, novel.canon, { required: true })
  if (!continuity.ok) {
    throw new Error(`plan rejected before write (continuity contract): ${continuity.errors.join("; ")}`)
  }
  writeFileSync(planPath, stringify(plan), "utf-8")
  console.log(`[LOOP] plan: wrote ${planPath} (${outcome.usage.promptTokens}→${outcome.usage.completionTokens} tok, $${outcome.cost.toFixed(5)})`)
  return plan
}

// ── 2. Draft ───────────────────────────────────────────────────────────────

export function outlineFromPlan(plan: PlanChapter): ChapterOutlineLike {
  return {
    chapterNumber: plan.chapter,
    title: plan.title,
    targetWords: plan.target_words,
    povCharacter: plan.pov,
    charactersPresent: plan.characters_present,
    scenes: plan.scenes.map(s => ({
      description: s.description,
      sceneId: s.scene_id,
      beatId: s.beat_id,
    })),
  }
}

export interface DraftGate {
  passed: boolean
  blockers: string[]
  integrityIssues: number
  qualityHigh: number
}

export function runDeterministicGate(prose: string, plan: PlanChapter): DraftGate {
  const validation = validateChapterDraft(prose, outlineFromPlan(plan), "validation")
  const integrity = detectProseIntegrityIssues(prose)
  const quality = detectSyncDefects(prose)
  const gate: DraftGate = {
    passed: validation.blockers.length === 0 && quality.filter(d => d.severity === "high").length === 0,
    blockers: validation.blockers,
    integrityIssues: integrity.length,
    qualityHigh: quality.filter(d => d.severity === "high").length,
  }
  console.log(`[LOOP] gate: blockers=${gate.blockers.length} integrity=${gate.integrityIssues} qualityHigh=${gate.qualityHigh} → ${gate.passed ? "ok" : "HARD FAIL"}`)
  return gate
}

export async function draftStep(novel: NovelDir, n: number, opts: StepOptions): Promise<{ prose: string; gate: DraftGate }> {
  const plan = readPlan(novel, n)
  if (opts.dry) {
    const prose = readChapter(novel, n)
    console.log(`[LOOP] draft: using existing ${novel.chapterPath(n)} (dry)`)
    return { prose, gate: runDeterministicGate(prose, plan) }
  }

  const system = readPrompt("writer/beat-writer-system.md")
  const sceneProses: string[] = []
  for (let i = 0; i < plan.scenes.length; i++) {
    const brief = renderWriterBrief(plan, novel.canon, i)
    const outcome = await callLLM({
      agent: "writer",
      systemPrompt: system,
      userPrompt: brief,
      // beat-writer-system.md: plain prose, no JSON wrapper.
      responseFormat: "text",
      thinking: false,
      chapter: n,
      sessionId: opts.sessionId,
      logMetadata: { sceneIndex: i, sceneId: plan.scenes[i]?.scene_id ?? null },
    })
    const prose = extractWriterProse(outcome.content)
    sceneProses.push(prose.trim())
    console.log(`[LOOP] draft scene ${i + 1}/${plan.scenes.length} (${outcome.usage.promptTokens}→${outcome.usage.completionTokens} tok, $${outcome.cost.toFixed(5)})`)
  }
  const prose = sceneProses.join("\n\n")
  const gate = runDeterministicGate(prose, plan)
  writeChapter(novel, n, prose)
  return { prose, gate }
}

// ── 3. Review (one merged judge) ───────────────────────────────────────────

export async function reviewStep(novel: NovelDir, n: number, opts: StepOptions): Promise<ReviewResult> {
  const plan = readPlan(novel, n)
  const prose = readChapter(novel, n)
  const system = readPrompt("reviewer-rubric.md")
  const user = renderReviewerContext(plan, novel.canon, prose, n)
  const result = await callAgent({
    agent: "reviewer",
    systemPrompt: system,
    userPrompt: user,
    schema: ReviewSchema,
    thinking: true,
    chapter: n,
    sessionId: opts.sessionId,
  })
  const outPath = novel.reviewPath(n)
  ensureDir(outPath)
  writeFileSync(outPath, JSON.stringify(result.output, null, 2), "utf-8")
  const nDev = result.output.plan_adherence.deviations.length
  const nFacts = result.output.continuity.facts_contradicted.length
  const nState = result.output.continuity.state_violations.length
  const nPlanned = result.output.planned_state.ungrounded.length
  const nObl = result.output.event_enactment.missing_obligations.length
  console.log(`[LOOP] review: passed=${result.output.passed} deviations=${nDev} facts=${nFacts} state=${nState} ungrounded=${nPlanned} missingObligations=${nObl} → ${outPath}`)
  return result.output
}

// ── 4. Fix (bounded, flagged scenes only) ──────────────────────────────────

export async function fixStep(novel: NovelDir, n: number, review: ReviewResult, opts: StepOptions): Promise<void> {
  const flagged = review.plan_adherence.deviations
    .filter(d => d.beat_index != null)
    .map(d => ({ beatIndex: d.beat_index as number, description: d.description }))
  if (opts.dry || flagged.length === 0) {
    console.log(`[LOOP] fix: ${opts.dry ? "dry — " : ""}no flagged scenes to rewrite`)
    return
  }
  const prose = readChapter(novel, n)
  const plan = readPlan(novel, n)
  const fixerPrompt = [
    "Fix ONLY the flagged scenes of the chapter below. Never rewrite unflagged scenes.",
    "For each flag: rewrite the flagged scene so it satisfies the finding, keeping the rest of the chapter verbatim.",
    "",
    "FLAGGED SCENES:",
    flagged.map(f => `- beat ${f.beatIndex}: ${f.description}`).join("\n"),
    "",
    "PLAN (scene descriptions only):",
    plan.scenes.map((s, i) => `- beat ${i}: ${s.description}`).join("\n"),
    "",
    "CHAPTER PROSE:\n" + prose,
  ].join("\n")

  const system = readPrompt("writer/prose-writer-system.md")
  for (let pass = 0; pass < opts.maxFixPasses; pass++) {
    const outcome = await callLLM({
      agent: "fixer",
      systemPrompt: system,
      userPrompt: fixerPrompt,
      responseFormat: "text",
      thinking: false,
      chapter: n,
      sessionId: opts.sessionId,
      logMetadata: { fixPass: pass },
    })
    const gate = runDeterministicGate(outcome.content, plan)
    if (gate.passed) {
      writeChapter(novel, n, outcome.content)
      console.log(`[LOOP] fix: pass ${pass + 1} cleared the gate → ${novel.chapterPath(n)}`)
      return
    }
    console.log(`[LOOP] fix: pass ${pass + 1} did not clear the gate; retrying`)
  }
  console.warn(`[LOOP] fix: exhausted ${opts.maxFixPasses} passes — chapter left as-is for operator review`)
}

// ── 5. Disposition (L121) ──────────────────────────────────────────────────

const PROVISIONAL_BY_KIND: Array<{ match: (r: ReviewResult) => boolean; classification: string }> = [
  { match: r => r.plan_adherence.deviations.length > 0, classification: "source defect" },
  { match: r => r.continuity.facts_contradicted.some(f => f.classification === "logical_contradiction"), classification: "source defect" },
  { match: r => r.continuity.state_violations.length > 0, classification: "reviewer calibration" },
  { match: r => r.planned_state.ungrounded.length > 0, classification: "source defect" },
  { match: r => r.event_enactment.missing_obligations.length > 0, classification: "layer cluster" },
]

export function provisionalClassification(review: ReviewResult, gate: DraftGate): string[] {
  const classes = PROVISIONAL_BY_KIND.filter(pair => pair.match(review)).map(p => p.classification)
  if (gate.integrityIssues > 0 || gate.qualityHigh > 0) classes.push("repair-layer defect")
  return [...new Set(classes)]
}

export async function disposeStep(novel: NovelDir, n: number, review: ReviewResult, gate: DraftGate, opts: StepOptions): Promise<void> {
  const classes = provisionalClassification(review, gate)
  const md = [
    `# Chapter ${n} Review & Disposition`,
    "",
    `- novel: ${novel.name}`,
    `- status: ${review.passed ? "passed" : "findings"}`,
    `- session: ${opts.sessionId}`,
    "- provisional classifications (operator-confirm before integrating):",
    ...(classes.length ? classes.map(c => `  - ${c}`) : ["  - story-specific one-off (no generalized signal)"]),
    "",
    "## Review summary",
    ...(review.plan_adherence.deviations.length
      ? ["", "### Plan adherence deviations"]
      : []),
    ...review.plan_adherence.deviations.map(d => `- beat ${d.beat_index ?? "—"}: ${d.description}`),
    ...(review.continuity.facts_contradicted.length
      ? ["", "### Fact contradictions"]
      : []),
    ...review.continuity.facts_contradicted.map(f => `- [${f.severity}] ${f.fact}${f.fact_id ? ` (${f.fact_id})` : ""} — ${f.reasoning}`),
    ...(review.continuity.state_violations.length
      ? ["", "### State violations"]
      : []),
    ...review.continuity.state_violations.map(v => `- [${v.severity ?? "warning"}] ${v.character} ${v.type}: ${v.reasoning}`),
    ...(review.planned_state.ungrounded.length
      ? ["", "### Planned state ungrounded"]
      : []),
    ...review.planned_state.ungrounded.map(u => `- ${u.planned_item_id} (${u.kind}): ${u.issue}`),
    ...(review.event_enactment.missing_obligations.length
      ? ["", "### Missing obligations"]
      : []),
    ...review.event_enactment.missing_obligations.map(o => `- beat ${o.beat_index}: ${o.obligation}`),
    "",
    "## Lesson",
    "",
    "- observation:",
    "- cause:",
    "- action:",
    "- status: pending",
    "",
  ].join("\n")
  ensureDir(novel.feedbackPath(n))
  writeFileSync(novel.feedbackPath(n), md, "utf-8")

  // LESSONS.md append — entries go ABOVE the trailing marker comment.
  const lessonsPath = resolve(import.meta.dir + "/../../LESSONS.md")
  const lessons = readFileSync(lessonsPath, "utf-8")
  if (!lessons.includes(opts.sessionId)) {
    const lesson = [
      `### L-${n}-${opts.sessionId.slice(-6)}: <one-line lesson title>`,
      `- chapter: ${novel.name} ch${n}`,
      `- observation: <see feedback/ch${String(n).padStart(2, "0")}-review.md>`,
      `- classification: ${classes.join(", ") || "pending"}`,
      `- status: pending`,
      "",
    ].join("\n")
    const marker = "<!-- New lessons append above this comment. -->"
    const updated = lessons.includes(marker)
      ? lessons.replace(marker, lesson + marker)
      : lessons + lesson
    writeFileSync(lessonsPath, updated, "utf-8")
  }

  // state.md update
  const state = readState(novel)
  state.currentChapter = Math.max(state.currentChapter, n)
  writeState(novel, state)
  console.log(`[LOOP] disposition: ${novel.feedbackPath(n)} written; state.currentChapter=${state.currentChapter}`)
}

// ── 6. Orchestrator ────────────────────────────────────────────────────────

export type LoopStepName = "plan" | "draft" | "review" | "fix" | "dispose"

export async function runChapter(novelDirOrName: string, n: number, opts: Partial<StepOptions> & { steps?: LoopStepName[] } = {}): Promise<void> {
  const novel = openNovel(novelDirOrName)
  const full: StepOptions = {
    dry: opts.dry ?? false,
    sessionId: opts.sessionId ?? `novel-${novel.name}-ch${n}-${Date.now()}`,
    maxFixPasses: opts.maxFixPasses ?? 2,
    forceReview: opts.forceReview ?? false,
  }
  const steps = opts.steps ?? ["plan", "draft", "review", "fix", "dispose"]
  console.log(`[LOOP] ${novel.name} ch${n} session=${full.sessionId} dry=${full.dry} steps=${steps.join(",")}`)

  const plan = steps.includes("plan") ? await planStep(novel, n, full) : readPlan(novel, n)
  let gate: DraftGate = { passed: true, blockers: [], integrityIssues: 0, qualityHigh: 0 }
  if (steps.includes("draft")) {
    const { gate: g } = await draftStep(novel, n, full)
    gate = g
  } else if (existsSync(novel.chapterPath(n))) {
    gate = runDeterministicGate(readChapter(novel, n), plan)
  }
  if (!gate.passed && !full.forceReview) {
    console.warn(`[LOOP] gate HARD FAIL — stopping before review (force with --force-review)`)
    return
  }
  if (steps.includes("review") || steps.includes("fix") || steps.includes("dispose")) {
    const review = steps.includes("review")
      ? await reviewStep(novel, n, full)
      : JSON.parse(readFileSync(novel.reviewPath(n), "utf-8")) as ReviewResult
    if (steps.includes("fix")) await fixStep(novel, n, review, full)
    if (steps.includes("dispose")) await disposeStep(novel, n, review, gate, full)
  }
  console.log(`[LOOP] done. next: bun src/loop/run.ts ${novel.name} ${n + 1}`)
}
