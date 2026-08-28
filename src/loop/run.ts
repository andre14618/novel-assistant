import { runChapter, type LoopStepName } from "./steps"

/**
 * Chapter loop CLI (phase 3 gate):
 *
 *   bun src/loop/run.ts <novelDirOrName> <chapterN> [--dry] [--force-review]
 *        [--steps plan,draft,review,fix,dispose] [--session <id>]
 *
 * Dry mode: plan/draft read existing files, review runs through the real
 * LLM path with LLM_OFFLINE=1 + LLM_OFFLINE_RESPONSE=<review.json>, fix
 * is skipped. No live LLM needed.
 */

const args = process.argv.slice(2)
const novelDirOrName = args[0]
const chapterRaw = args[1]
if (!novelDirOrName || !chapterRaw) {
  console.error("usage: bun src/loop/run.ts <novelDirOrName> <chapterN> [--dry] [--force-review] [--steps ...] [--session <id>]")
  process.exit(2)
}
const n = Number(chapterRaw)
const dry = args.includes("--dry")
const forceReview = args.includes("--force-review")
const stepsRaw = args.indexOf("--steps") >= 0 ? args[args.indexOf("--steps") + 1] : undefined
const sessionId = args.indexOf("--session") >= 0 ? args[args.indexOf("--session") + 1] : undefined
const steps = stepsRaw ? stepsRaw.split(",") as LoopStepName[] : undefined

await runChapter(novelDirOrName, n, { dry, forceReview, sessionId, steps })
