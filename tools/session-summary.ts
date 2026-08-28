import { openDb } from "../src/db"

/**
 * Per-session/per-chapter cost & quality summary (proposal §6):
 *   bun tools/session-summary.ts [--session <id>] [--chapter <n>] [--latest]
 *
 * Prints per-agent call stats + totals, then cost joined to review outcomes
 * where chapters/reviews rows exist. No args = whole db.
 */

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const sessionId = flag("--session")
const chapterRaw = flag("--chapter")
const chapter = chapterRaw ? Number(chapterRaw) : undefined
const latest = args.includes("--latest")

const db = openDb()

let where = "1=1"
const params: Record<string, unknown> = {}
if (sessionId) { where += " AND session_id = $session"; params.$session = sessionId }
if (chapter) { where += " AND chapter = $chapter"; params.$chapter = chapter }
if (latest) {
  const last = db.query("SELECT DISTINCT session_id FROM llm_calls WHERE session_id IS NOT NULL ORDER BY timestamp DESC LIMIT 1").get()
  if (last) { where += " AND session_id = $last"; params.$last = (last as any).session_id }
}

const rows = db.query(/* sql */ `
  SELECT agent,
         COUNT(*) AS calls,
         SUM(failed) AS failed,
         SUM(prompt_tokens) AS prompt_tokens,
         SUM(completion_tokens) AS completion_tokens,
         SUM(cached_tokens) AS cached_tokens,
         SUM(cost) AS cost,
         AVG(latency_ms) AS avg_latency_ms,
         AVG(tokens_per_sec) AS avg_tps
  FROM llm_calls
  WHERE ${where}
  GROUP BY agent
  ORDER BY cost DESC
`).all(params as any) as Array<Record<string, any>>

if (rows.length === 0) {
  console.log("No calls found." + (sessionId ? ` (session '${sessionId}')` : ""))
  process.exit(0)
}

const pad = (s: string | number, n: number) => String(s).padEnd(n)
const money = (n: number) => `$${n.toFixed(5)}`
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

console.log(`${pad("agent", 14)}${pad("calls", 6)}${pad("failed", 7)}${pad("prompt", 12)}${pad("completion", 12)}${pad("cache%", 8)}${pad("cost", 10)}${pad("avgLatMs", 10)}${pad("avgTps", 8)}`)
for (const r of rows) {
  const cacheRate = r.prompt_tokens > 0 ? r.cached_tokens / r.prompt_tokens : 0
  console.log(
    `${pad(r.agent, 14)}${pad(r.calls, 6)}${pad(r.failed, 7)}` +
    `${pad(r.prompt_tokens, 12)}${pad(r.completion_tokens, 12)}${pad(pct(cacheRate), 8)}` +
    `${pad(money(r.cost), 10)}${pad(Math.round(r.avg_latency_ms ?? 0), 10)}${pad(Math.round(r.avg_tps ?? 0), 8)}`,
  )
}

const totals = rows.reduce((acc, r) => ({
  calls: acc.calls + r.calls, failed: acc.failed + r.failed,
  prompt: acc.prompt + r.prompt_tokens, completion: acc.completion + r.completion_tokens,
  cached: acc.cached + r.cached_tokens, cost: acc.cost + r.cost,
}), { calls: 0, failed: 0, prompt: 0, completion: 0, cached: 0, cost: 0 })
const totalCacheRate = totals.prompt > 0 ? totals.cached / totals.prompt : 0
console.log(`\nTOTAL ${totals.calls} calls, ${totals.failed} failed, ${totals.prompt}→${totals.completion} tokens (${pct(totalCacheRate)} cache hit), ${money(totals.cost)}`)

// Cost joined to review outcomes (RL signal from proposal §6): reviews rows
// reference chapters by id, so only report when chapters data exists.
const reviews = db.query(/* sql */ `
  SELECT c.novel, c.n AS chapter, r.disposition, r.passed, r.judge_version, r.created_at
  FROM reviews r JOIN chapters c ON c.id = r.chapter_id
  ORDER BY c.novel, c.n
`).all() as Array<Record<string, any>>
if (reviews.length > 0) {
  console.log("\nreviews on file:")
  for (const rev of reviews) {
    console.log(`  ${rev.novel} ch${rev.chapter}: disposition=${rev.disposition} passed=${rev.passed ? "yes" : "no"} judge=${rev.judge_version ?? "?"} (${rev.created_at})`)
  }
}
