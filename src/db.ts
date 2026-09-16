import { Database } from "bun:sqlite"

/**
 * SQLite telemetry store (calls.db). One file, no ORM, no migrations table —
 * schema is created idempotently on first open. The database records LLM-call
 * telemetry only; chapter, review, and feedback artifacts remain file-first
 * under novels/<name>/ and are versioned by Git.
 */

export interface LLMCallEntry {
  sessionId?: string | null
  timestamp: string
  agent: string
  phase?: string | null
  model: string
  provider?: string
  temperature?: number | null
  maxTokens?: number | null
  promptTokens: number
  completionTokens: number
  cachedTokens: number
  latencyMs: number
  tokensPerSec: number
  cost: number
  chapter?: number | null
  seed?: string | null
  dimension?: string | null
  jsonExtractionSuccess: boolean
  jsonExtractionRetried: boolean
  zodValidationSuccess: boolean
  zodErrors?: string | null
  httpAttempts: number
  retryErrors?: string | null
  systemPrompt?: string | null
  userPrompt?: string | null
  responseContent?: string | null
  requestJson?: string | null
  failed: boolean
  errorText?: string | null
  beatIndex?: number | null
  sceneId?: string | null
  beatId?: string | null
  attempt?: number | null
}

const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS llm_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  timestamp TEXT NOT NULL,
  agent TEXT NOT NULL,
  phase TEXT,
  model TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'deepseek',
  temperature REAL,
  max_tokens INTEGER,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  tokens_per_sec INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  chapter INTEGER,
  seed TEXT,
  dimension TEXT,
  json_extraction_success INTEGER NOT NULL DEFAULT 1,
  json_extraction_retried INTEGER NOT NULL DEFAULT 0,
  zod_validation_success INTEGER NOT NULL DEFAULT 1,
  zod_errors TEXT,
  http_attempts INTEGER NOT NULL DEFAULT 1,
  retry_errors TEXT,
  system_prompt TEXT,
  user_prompt TEXT,
  response_content TEXT,
  request_json TEXT,
  failed INTEGER NOT NULL DEFAULT 0,
  error_text TEXT,
  beat_index INTEGER,
  scene_id TEXT,
  beat_id TEXT,
  attempt INTEGER,
  ner_prepass_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_llm_calls_session ON llm_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_llm_calls_chapter ON llm_calls(chapter);
CREATE INDEX IF NOT EXISTS idx_llm_calls_agent ON llm_calls(agent);
`

let db: Database | null = null

export function openDb(path: string = import.meta.dir + "/../calls.db"): Database {
  if (db) return db
  db = new Database(path, { create: true })
  db.run("PRAGMA journal_mode = WAL")
  db.exec(SCHEMA)
  return db
}

export function insertLLMCall(entry: LLMCallEntry): number {
  const database = openDb()
  const result = database.query(/* sql */ `
    INSERT INTO llm_calls (
      session_id, timestamp, agent, phase, model, provider, temperature, max_tokens,
      prompt_tokens, completion_tokens, cached_tokens, latency_ms, tokens_per_sec, cost,
      chapter, seed, dimension, json_extraction_success, json_extraction_retried,
      zod_validation_success, zod_errors, http_attempts, retry_errors,
      system_prompt, user_prompt, response_content, request_json,
      failed, error_text, beat_index, scene_id, beat_id, attempt
    ) VALUES (
      $sessionId, $timestamp, $agent, $phase, $model, $provider, $temperature, $maxTokens,
      $promptTokens, $completionTokens, $cachedTokens, $latencyMs, $tokensPerSec, $cost,
      $chapter, $seed, $dimension, $jsonExtractionSuccess, $jsonExtractionRetried,
      $zodValidationSuccess, $zodErrors, $httpAttempts, $retryErrors,
      $systemPrompt, $userPrompt, $responseContent, $requestJson,
      $failed, $errorText, $beatIndex, $sceneId, $beatId, $attempt
    )
  `).run({
    $sessionId: entry.sessionId ?? null,
    $timestamp: entry.timestamp,
    $agent: entry.agent,
    $phase: entry.phase ?? null,
    $model: entry.model,
    $provider: entry.provider ?? "deepseek",
    $temperature: entry.temperature ?? null,
    $maxTokens: entry.maxTokens ?? null,
    $promptTokens: entry.promptTokens,
    $completionTokens: entry.completionTokens,
    $cachedTokens: entry.cachedTokens,
    $latencyMs: entry.latencyMs,
    $tokensPerSec: entry.tokensPerSec,
    $cost: entry.cost,
    $chapter: entry.chapter ?? null,
    $seed: entry.seed ?? null,
    $dimension: entry.dimension ?? null,
    $jsonExtractionSuccess: entry.jsonExtractionSuccess ? 1 : 0,
    $jsonExtractionRetried: entry.jsonExtractionRetried ? 1 : 0,
    $zodValidationSuccess: entry.zodValidationSuccess ? 1 : 0,
    $zodErrors: entry.zodErrors ?? null,
    $httpAttempts: entry.httpAttempts,
    $retryErrors: entry.retryErrors ?? null,
    $systemPrompt: entry.systemPrompt ?? null,
    $userPrompt: entry.userPrompt ?? null,
    $responseContent: entry.responseContent ?? null,
    $requestJson: entry.requestJson ?? null,
    $failed: entry.failed ? 1 : 0,
    $errorText: entry.errorText ?? null,
    $beatIndex: entry.beatIndex ?? null,
    $sceneId: entry.sceneId ?? null,
    $beatId: entry.beatId ?? null,
    $attempt: entry.attempt ?? null,
  })
  return Number(result.lastInsertRowid)
}
