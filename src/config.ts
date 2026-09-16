import { readFileSync } from "node:fs"
import { z } from "zod"

const ModelPricingSchema = z.object({
  inputPerMTok: z.number().nonnegative(),
  outputPerMTok: z.number().nonnegative(),
  cacheDiscount: z.number().min(0).max(1),
})

const AgentConfigSchema = z.object({
  model: z.string(),
  thinking: z.boolean().default(false),
  maxTokens: z.number().int().positive().optional(),
})

export const AppConfigSchema = z.object({
  apiUrl: z.string().url(),
  defaultModel: z.string().default("deepseek-v4-flash"),
  defaultMaxTokens: z.number().int().positive().default(8192),
  retries: z.number().int().min(0).max(5).default(2),
  models: z.record(z.string(), ModelPricingSchema),
  agents: z.record(z.string(), AgentConfigSchema).default({}),
})

export type AppConfig = z.infer<typeof AppConfigSchema>
export type ModelPricing = z.infer<typeof ModelPricingSchema>
export type AgentConfig = z.infer<typeof AgentConfigSchema>

let cached: AppConfig | null = null

export function loadConfig(): AppConfig {
  if (cached) return cached
  const raw = readFileSync(import.meta.dir + "/../config.json", "utf-8")
  const parsed = AppConfigSchema.parse(JSON.parse(raw))
  const model = process.env.LLM_MODEL
  cached = {
    ...parsed,
    apiUrl: process.env.LLM_API_URL ?? parsed.apiUrl,
    defaultModel: model ?? parsed.defaultModel,
    agents: model
      ? Object.fromEntries(Object.entries(parsed.agents).map(([agent, cfg]) => [agent, { ...cfg, model }]))
      : parsed.agents,
  }
  return cached
}

export function getAgentConfig(agent: string): AgentConfig {
  const cfg = loadConfig()
  return cfg.agents[agent] ?? { model: cfg.defaultModel, thinking: false }
}

export function getModelPricing(model: string): ModelPricing {
  const cfg = loadConfig()
  const pricing = cfg.models[model]
  if (!pricing) throw new Error(`Unknown model '${model}' in config.json (known: ${Object.keys(cfg.models).join(", ")})`)
  return pricing
}
