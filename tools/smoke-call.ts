import { z } from "zod"
import { callAgent } from "../src/llm"

/**
 * Phase-1 gate smoke: performs one dummy structured call and verifies the
 * row landed in calls.db, then prints it. Runs offline via LLM_OFFLINE=1
 * (no network, no API key needed).
 *
 *   LLM_OFFLINE=1 bun run smoke
 */

const DummyResponse = z.object({
  ok: z.boolean(),
  greeting: z.string().min(1),
})

// Ensure an offline-safe env for the dummy call regardless of caller env.
process.env.LLM_OFFLINE = process.env.LLM_OFFLINE ?? "1"

const result = await callAgent({
  agent: "reviewer",
  systemPrompt: "You are a chapter reviewer. Reply with JSON.",
  userPrompt: "Say hello in JSON: {\"ok\": true, \"greeting\": \"...\"}",
  schema: DummyResponse,
  chapter: 1,
  sessionId: "smoke-session",
  logMetadata: { kind: "smoke" },
})

console.log(`\noutput:`, JSON.stringify(result.output))
console.log(`tokens:`, JSON.stringify(result.tokensUsed))
console.log(`llm_calls row:`, result.llmCallId)

const row = (await import("../src/db")).openDb().query(
  "SELECT id, session_id, agent, model, prompt_tokens, completion_tokens, cached_tokens, cost, failed FROM llm_calls WHERE id = ?",
).get(result.llmCallId)
console.log("\npersisted row:", row ?? "MISSING — gate FAILED")
