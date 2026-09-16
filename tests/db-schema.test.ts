import { describe, expect, test } from "bun:test"
import { openDb } from "../src/db"

describe("telemetry schema", () => {
  test("creates only the live llm_calls application table", () => {
    const db = openDb(":memory:")
    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map(row => row.name)

    expect(tables).toEqual(["llm_calls"])
  })
})
