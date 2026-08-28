import { openDb } from "../src/db"

/**
 * LLM inspector (proposal §6 replacement for the React inspector):
 *   bun tools/inspect-calls.ts [--agent <name>] [--chapter <n>] [--session <id>] [--failed] [--limit <n>]
 */

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const limit = Number(flag("--limit") ?? "20")

let where = "1=1"
const params: Record<string, unknown> = {}
const agent = flag("--agent")
const chapterRaw = flag("--chapter")
const session = flag("--session")
if (agent) { where += " AND agent = $agent"; params.$agent = agent }
if (chapterRaw) { where += " AND chapter = $chapter"; params.$chapter = Number(chapterRaw) }
if (session) { where += " AND session_id = $session"; params.$session = session }
if (args.includes("--failed")) where += " AND failed = 1"

const db = openDb()
const rows = db.query(/* sql */ `
  SELECT id, timestamp, agent, model, chapter, session_id, prompt_tokens, completion_tokens,
         cached_tokens, cost, latency_ms, failed, json_extraction_success, zod_validation_success, response_content
  FROM llm_calls
  WHERE ${where}
  ORDER BY id DESC
  LIMIT $limit
`).all({ ...params, $limit: limit }) as Array<Record<string, any>>

if (rows.length === 0) {
  console.log("No matching calls.")
  process.exit(0)
}

for (const r of rows) {
  console.log(`#${r.id} ${r.timestamp} ${r.agent} ${r.model}${r.chapter ? ` ch${r.chapter}` : ""}${r.session_id ? ` sess=${r.session_id}` : ""} | ${r.prompt_tokens}→${r.completion_tokens} tok (cache ${r.cached_tokens}) $${r.cost.toFixed(5)} | ${r.latency_ms}ms | ${r.failed ? "FAILED" : r.json_extraction_success ? "ok" : "json-fail"}${r.zod_validation_success ? "" : " zod-fail"} | ${(r.response_content ?? "").slice(0, 200).replace(/\s+/g, " ")}`)
}
