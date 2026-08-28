import { SQL } from "bun"

/**
 * One-time export from the old Postgres archive (proposal §4):
 *   OLD_DB_URL=postgres://... bun run export-old --tables seeds,chapters,...
 *
 * The old novel_harness_orchestrator DB stays read-only; anything worth
 * continuing (repaired sources, seeds, past feedback dispositions) is
 * exported to JSON in exports/<table>.json, keyed by run timestamp.
 *
 * Note: the old DB is currently down and this project has no live coupling
 * to it — the tool only works when the archive is reachable.
 */

const url = process.env.OLD_DB_URL
if (!url) {
  console.error("OLD_DB_URL not set — the old orchestrator DB is a read-only archive.")
  console.error("Set OLD_DB_URL to its Postgres URL, then pass --tables llm_calls,chapters,...")
  console.error(`Default export dir: ${import.meta.dir}/../exports`)
  process.exit(1)
}

const argIndex = process.argv.indexOf("--tables")
if (argIndex < 0 || !process.argv[argIndex + 1]) {
  console.error("Usage: OLD_DB_URL=... bun run export-old --tables table1,table2,...")
  process.exit(1)
}
const tables = process.argv[argIndex + 1]!.split(",").map((t) => t.trim()).filter(Boolean)

const outDir = import.meta.dir + "/../exports"
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const sql = new SQL(url)

for (const table of tables) {
  console.log(`exporting ${table} …`)
  const rows = await sql`SELECT * FROM ${sql(table)}`
  const file = `${outDir}/${table}-${stamp}.json`
  await Bun.write(file, JSON.stringify(rows, null, 2))
  console.log(`  → ${file} (${rows.length} rows)`)
}

await sql.close()
console.log("done.")
