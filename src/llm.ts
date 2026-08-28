import { readFileSync } from "node:fs"
import { z } from "zod"
import { getTokenCost } from "./cost"
import { getAgentConfig, loadConfig } from "./config"
import { insertLLMCall, type LLMCallEntry } from "./db"

/**
 * Slim DeepSeek client. Ported from novel-harness src/llm.ts core
 * (extractJSON, retry/timeout, usage extraction, cached-token accounting,
 * full logging guarantees) minus transport abstraction, trace/SSE,
 * heartbeat, and multi-provider registry.
 *
 * Guarantee: every callLLM produces exactly one llm_calls row — success or
 * failure — and prints the per-call console cost line (`[LLM] ...`).
 */

export const ENDPOINT = loadConfig().apiUrl

// ── Types ────────────────────────────────────────────────────────────────

export interface LLMUsage {
  promptTokens: number
  completionTokens: number
  cachedTokens: number
}

export interface RetryError {
  status: number
  delayMs: number
}

export interface CallOptions {
  agent: string
  systemPrompt: string
  userPrompt: string
  model?: string
  temperature?: number
  maxTokens?: number
  thinking?: boolean
  /** "json" adds response_format=json_object (DeepSeek JSON mode). */
  responseFormat?: "json" | "text"
  /** Drill-down tag joined into cost-per-chapter queries. */
  chapter?: number
  /** Tag for "what did chapter N session cost" aggregation. */
  sessionId?: string
  /** Extra per-call context persisted to request_json (never prompt text). */
  logMetadata?: Record<string, unknown>
}

export interface CallOutcome {
  content: string
  usage: LLMUsage
  totalLatencyMs: number
  httpAttempts: number
  retryErrors: RetryError[]
  finishReason: string | null
  cost: number
  llmCallId: number
}

export class CompletionCapError extends Error {
  constructor(public agent: string, public model: string, public completionTokens: number, public maxTokens: number) {
    super(`LLM completion hit max token cap for ${agent} (${model}): completion_tokens=${completionTokens} maxTokens=${maxTokens}`)
  }
}

// ── JSON extraction (ported verbatim from novel-harness src/llm.ts) ──────

export function extractJSON(raw: string): string {
  try { JSON.parse(raw); return raw } catch {}

  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    try { JSON.parse(codeBlockMatch[1]!.trim()); return codeBlockMatch[1]!.trim() } catch {}
  }

  const braceStart = raw.indexOf("{")
  const bracketStart = raw.indexOf("[")
  let start = -1
  if (braceStart >= 0 && (bracketStart < 0 || braceStart < bracketStart)) start = braceStart
  else if (bracketStart >= 0) start = bracketStart

  if (start >= 0) {
    const openChar = raw[start]!
    const closeChar = openChar === "{" ? "}" : "]"
    let depth = 0
    for (let i = start; i < raw.length; i++) {
      if (raw[i] === openChar) depth++
      else if (raw[i] === closeChar) depth--
      if (depth === 0) {
        const candidate = raw.slice(start, i + 1)
        try { JSON.parse(candidate); return candidate } catch {}
      }
    }
  }

  throw new Error(`Could not extract JSON from response:\n${raw.slice(0, 500)}`)
}

// ── Request execution ─────────────────────────────────────────────────────

interface RawResponse {
  content: string
  usage: LLMUsage
  finishReason: string | null
  httpAttempts: number
  retryErrors: RetryError[]
}

function offlineResponse(opts: CallOptions): RawResponse {
  // LLM_OFFLINE_RESPONSE: path to a JSON-compatible response payload. The
  // loop dry-run uses this to exercise the real call/logging path with a
  // canned completion (e.g. a pre-recorded review artifact).
  const overridePath = process.env.LLM_OFFLINE_RESPONSE
  let content = opts.responseFormat === "json"
    ? JSON.stringify({ ok: true, greeting: "Hello from offline DeepSeek" })
    : "Offline mode: canned completion. No LLM was called."
  if (overridePath) {
    content = readFileSync(overridePath, "utf-8")
  }
  return {
    content,
    usage: { promptTokens: 42, completionTokens: 7, cachedTokens: 30 },
    finishReason: "stop",
    httpAttempts: 1,
    retryErrors: [],
  }
}

async function executeRequest(opts: CallOptions): Promise<RawResponse> {
  const cfg = loadConfig()
  const agentCfg = getAgentConfig(opts.agent)
  const model = opts.model ?? agentCfg.model ?? cfg.defaultModel
  const maxTokens = opts.maxTokens ?? agentCfg.maxTokens ?? cfg.defaultMaxTokens
  const thinking = opts.thinking ?? agentCfg.thinking

  if (process.env.LLM_OFFLINE === "1") return offlineResponse(opts)

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set (see .env.example)")

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
    max_tokens: maxTokens,
    temperature: opts.temperature ?? 0,
  }
  if (opts.responseFormat === "json") body.response_format = { type: "json_object" }
  if (thinking) body.thinking = { type: "enabled" }

  const maxAttempts = 1 + cfg.retries
  const retryErrors: RetryError[] = []
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startedAt = Date.now()
    let res: Response
    try {
      res = await fetch(cfg.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      })
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < maxAttempts) {
        const delayMs = 500 * 2 ** (attempt - 1)
        retryErrors.push({ status: 0, delayMs })
        await Bun.sleep(delayMs)
        continue
      }
      break
    }

    const json = await res.json().catch(() => null)
    if (!res.ok) {
      const detail = json ? JSON.stringify(json).slice(0, 300) : res.statusText
      lastError = new Error(`DeepSeek API ${res.status}: ${detail}`)
      if (res.status === 429 || res.status >= 500) {
        if (attempt < maxAttempts) {
          const delayMs = 500 * 2 ** (attempt - 1)
          retryErrors.push({ status: res.status, delayMs })
          await Bun.sleep(delayMs)
          continue
        }
      }
      break
    }

    const data = json as any
    const choice = data.choices?.[0]
    const usage = data.usage ?? {}
    return {
      content: String(choice?.message?.content ?? ""),
      usage: {
        promptTokens: Number(usage.prompt_tokens ?? 0),
        completionTokens: Number(usage.completion_tokens ?? 0),
        cachedTokens: Number(usage.cached_tokens ?? usage.prompt_cache_hit_tokens ?? 0),
      },
      finishReason: choice?.finish_reason ?? null,
      httpAttempts: attempt,
      retryErrors,
    }
  }
  throw lastError ?? new Error("DeepSeek request failed after retries")
}

// ── Outcome → llm_calls row + console line ───────────────────────────────

function requestJsonForLog(opts: CallOptions, model: string, finishReason: string | null | undefined): string {
  return JSON.stringify({
    model,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    thinking: opts.thinking,
    responseFormat: opts.responseFormat ?? null,
    callerId: opts.agent,
    meta: opts.logMetadata ?? null,
    finishReason: finishReason ?? null,
  })
}

function writeLogRow(
  opts: CallOptions,
  model: string,
  mood: {
    promptTokens: number; completionTokens: number; cachedTokens: number;
    latencyMs: number; httpAttempts: number; retryErrors: RetryError[];
    content?: string; failed: boolean; errorText?: string;
    jsonExtractionSuccess: boolean; jsonExtractionRetried: boolean;
    zodValidationSuccess: boolean; zodErrors?: string;
  },
): number {
  const tps = mood.latencyMs > 0 && mood.completionTokens > 0
    ? Math.round(mood.completionTokens / (mood.latencyMs / 1000))
    : 0
  const cost = mood.failed
    ? 0
    : getTokenCost(model, mood.promptTokens, mood.completionTokens, mood.cachedTokens)
  const entry: LLMCallEntry = {
    sessionId: opts.sessionId ?? null,
    timestamp: new Date().toISOString(),
    agent: opts.agent,
    model,
    temperature: opts.temperature ?? null,
    maxTokens: opts.maxTokens ?? null,
    promptTokens: mood.promptTokens,
    completionTokens: mood.completionTokens,
    cachedTokens: mood.cachedTokens,
    latencyMs: mood.latencyMs,
    tokensPerSec: tps,
    cost,
    chapter: opts.chapter ?? null,
    jsonExtractionSuccess: mood.jsonExtractionSuccess,
    jsonExtractionRetried: mood.jsonExtractionRetried,
    zodValidationSuccess: mood.zodValidationSuccess,
    zodErrors: mood.zodErrors ?? null,
    httpAttempts: mood.httpAttempts,
    retryErrors: mood.retryErrors.length ? JSON.stringify(mood.retryErrors) : null,
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    responseContent: mood.content ?? null,
    requestJson: requestJsonForLog(opts, model, mood.failed ? undefined : null),
    failed: mood.failed,
    errorText: mood.errorText ?? null,
  }
  const id = insertLLMCall(entry)
  const cachedSuffix = mood.cachedTokens > 0 ? ` [cache:${mood.cachedTokens}]` : ""
  console.error(`[LLM] ${opts.agent} ${model} ${mood.promptTokens}→${mood.completionTokens} tokens $${cost.toFixed(5)}${cachedSuffix}`)
  return id
}

// ── Public: raw completion ───────────────────────────────────────────────

export async function callLLM(opts: CallOptions): Promise<CallOutcome> {
  const cfg = loadConfig()
  const agentCfg = getAgentConfig(opts.agent)
  const model = opts.model ?? agentCfg.model ?? cfg.defaultModel
  const startedAt = Date.now()
  let outcome: CallOutcome
  try {
    const raw = await executeRequest(opts)
    const latencyMs = Date.now() - startedAt
    outcome = {
      content: raw.content,
      usage: raw.usage,
      totalLatencyMs: latencyMs,
      httpAttempts: raw.httpAttempts,
      retryErrors: raw.retryErrors,
      finishReason: raw.finishReason,
      cost: getTokenCost(model, raw.usage.promptTokens, raw.usage.completionTokens, raw.usage.cachedTokens),
      llmCallId: 0,
    }
    outcome.llmCallId = writeLogRow(opts, model, {
      promptTokens: raw.usage.promptTokens,
      completionTokens: raw.usage.completionTokens,
      cachedTokens: raw.usage.cachedTokens,
      latencyMs,
      httpAttempts: raw.httpAttempts,
      retryErrors: raw.retryErrors,
      content: raw.content,
      failed: false,
      jsonExtractionSuccess: true,
      jsonExtractionRetried: false,
      zodValidationSuccess: true,
    })
  } catch (err) {
    const latencyMs = Date.now() - startedAt
    writeLogRow(opts, model, {
      promptTokens: 0, completionTokens: 0, cachedTokens: 0,
      latencyMs, httpAttempts: 1, retryErrors: [],
      failed: true,
      errorText: err instanceof Error ? (err.stack ?? err.message) : String(err),
      jsonExtractionSuccess: false,
      jsonExtractionRetried: false,
      zodValidationSuccess: false,
    })
    throw err
  }
  if (outcome.finishReason === "length" && opts.maxTokens) {
    throw new CompletionCapError(opts.agent, model, outcome.usage.completionTokens, opts.maxTokens)
  }
  return outcome
}

// ── Public: schema-validated agent call ──────────────────────────────────

export interface AgentCallOptions<T> extends CallOptions {
  schema: z.ZodType<T>
}

export interface AgentCallResult<T> {
  output: T
  tokensUsed: { prompt: number; completion: number }
  llmCallId: number
}

/**
 * Structured call: JSON mode → extractJSON → zod parse. On zod/extract
 * failure, retries once appending the error to the user prompt (mirrors the
 * old extract-then-single-repair shape). Always logs one row per attempt.
 */
export async function callAgent<T>(opts: AgentCallOptions<T>): Promise<AgentCallResult<T>> {
  const repairUserPrompt = (rawControl: string) => `${opts.userPrompt}\n\nYour previous response failed validation:\n${rawControl.slice(0, 1500)}`

  let first: CallOutcome | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const outcome: CallOutcome = first !== null
      ? await callLLM({ ...opts, userPrompt: repairUserPrompt(first.content) })
      : await callLLM({ ...opts, responseFormat: "json" })
    const jsonStr = extractJSON(outcome.content)
    let output: T
    try {
      output = opts.schema.parse(JSON.parse(jsonStr))
    } catch (err) {
      if (attempt === 0) {
        first = outcome
        continue
      }
      throw new Error(`Agent '${opts.agent}' returned zod-invalid JSON after repair: ${err instanceof Error ? err.message : String(err)}`)
    }
    return { output, tokensUsed: { prompt: outcome.usage.promptTokens, completion: outcome.usage.completionTokens }, llmCallId: outcome.llmCallId }
  }
  throw new Error(`Agent '${opts.agent}' failed after JSON repair attempts`)
}
