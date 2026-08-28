import { z } from "zod"

/**
 * src/loop/review-schema.ts — merged reviewer output shape.
 * Mirrors prompts/reviewer-rubric.md output section.
 */

export const ReviewSchema = z.object({
  plan_adherence: z.object({
    setting_match: z.object({
      planned: z.string(),
      observed: z.string(),
      matches: z.boolean(),
    }),
    emotional_arc_correct: z.boolean(),
    pass: z.boolean(),
    deviations: z.array(z.object({
      description: z.string(),
      beat_index: z.number().int().nullable(),
    })),
  }),
  continuity: z.object({
    facts_contradicted: z.array(z.object({
      fact: z.string(),
      fact_id: z.string().nullable().optional(),
      severity: z.enum(["blocker", "warning", "nit"]),
      classification: z.enum(["logical_contradiction", "contextual_narrowing", "omission", "uncertain"]),
      evidence: z.string(),
      reasoning: z.string(),
    })),
    state_violations: z.array(z.object({
      character: z.string(),
      type: z.enum(["location", "knowledge"]),
      severity: z.enum(["blocker", "warning", "nit"]).optional(),
      evidence: z.string(),
      reasoning: z.string(),
    })),
  }),
  planned_state: z.object({
    ungrounded: z.array(z.object({
      planned_item_id: z.string(),
      kind: z.enum(["fact", "knowledge_change", "character_state_change"]),
      issue: z.string(),
    })),
  }),
  event_enactment: z.object({
    missing_obligations: z.array(z.object({
      beat_index: z.number().int(),
      obligation: z.string(),
    })),
  }),
  passed: z.boolean(),
})

export type ReviewResult = z.infer<typeof ReviewSchema>
