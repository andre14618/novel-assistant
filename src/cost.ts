import { getModelPricing } from "./config"

/**
 * Token cost in USD. cached_tokens is a SUBSET of prompt_tokens: the cached
 * portion bills at the discounted rate, the miss portion at the full input
 * rate (same shape as novel-harness src/models/registry.ts:getTokenCost).
 */
export function getTokenCost(model: string, promptTokens: number, completionTokens: number, cachedTokens = 0): number {
  const p = getModelPricing(model)
  const cached = Math.min(Math.max(cachedTokens, 0), Math.max(promptTokens, 0))
  const miss = Math.max(promptTokens - cached, 0)
  const cachedRate = p.inputPerMTok * (1 - p.cacheDiscount)
  return (miss * p.inputPerMTok + cached * cachedRate + completionTokens * p.outputPerMTok) / 1_000_000
}
