/**
 * checks/quality.ts — per-beat quality defect detectors.
 *
 * Ported from novel-harness src/lint/quality-detectors.ts.
 * Three detectors: detectRepetition (regex n-gram), detectUnderlength
 * (word-count gate), detectVoiceCollapse (LLM-backed STUB — same as old
 * repo: intentionally deferred).
 *
 * Design decisions preserved:
 *   - Bigrams AND trigrams checked (ch2-b12 false-debt loop caught at ≥
 *     bigram resolution).
 *   - Window = 500 words by default (beats are 100-400 words).
 *   - `span` offsets are character offsets into the original prose string,
 *     pointing to the first occurrence of the repeated n-gram.
 */

export interface QualityDefect {
  kind: "repetition" | "voice-collapse" | "underlength"
  severity: "high" | "medium" | "low"
  description: string
  span?: { start: number; end: number }
  metadata?: Record<string, unknown>
}

export function detectRepetition(
  prose: string,
  options?: {
    minCount?: number
    windowWords?: number
    bigrams?: boolean
    trigrams?: boolean
  },
): QualityDefect[] {
  const minCount = options?.minCount ?? 3
  const windowWords = options?.windowWords ?? 500
  const includeBigrams = options?.bigrams ?? true
  const includeTrigrams = options?.trigrams ?? true

  const words = prose.split(/\s+/).filter(w => w.length > 0)
  if (words.length < 2) return []

  const limit = Math.min(words.length, windowWords)
  const windowTokens = words.slice(0, limit).map(w => w.toLowerCase().replace(/[^\w'-]/g, ""))

  const counts = new Map<string, number>()

  const countNgrams = (n: number): void => {
    for (let i = 0; i <= windowTokens.length - n; i++) {
      const gram = windowTokens.slice(i, i + n).join(" ")
      // Skip n-grams that are mostly stop words or very short
      const meaningful = windowTokens.slice(i, i + n).some(w => w.length >= 4)
      if (!meaningful) continue
      counts.set(gram, (counts.get(gram) ?? 0) + 1)
    }
  }

  if (includeBigrams) countNgrams(2)
  if (includeTrigrams) countNgrams(3)

  const defects: QualityDefect[] = []

  for (const [gram, count] of counts) {
    if (count < minCount) continue

    // Find character offset of first occurrence (case-insensitive)
    const pattern = gram.split(" ").join("\\s+")
    const regex = new RegExp(pattern, "i")
    const match = regex.exec(prose)
    const span = match ? { start: match.index, end: match.index + match[0].length } : undefined

    const severity: QualityDefect["severity"] = count >= 5 ? "high" : count === 4 ? "medium" : "low"
    const wordsLabel = gram.split(" ").length === 2 ? "bigram" : "trigram"

    defects.push({
      kind: "repetition",
      severity,
      description: `Repeated ${wordsLabel} "${gram}" appears ${count} times within ${limit}-word window — rephrase or restructure to avoid the loop.`,
      span,
      metadata: { gram, count, windowWords: limit, n: gram.split(" ").length },
    })
  }

  defects.sort((a, b) => {
    const ca = (a.metadata?.count as number) ?? 0
    const cb = (b.metadata?.count as number) ?? 0
    return cb - ca
  })

  return defects
}

export function detectUnderlength(
  prose: string,
  minWords = 50,
): QualityDefect[] {
  const wordCount = prose.trim().split(/\s+/).filter(w => w.length > 0).length
  if (wordCount >= minWords) return []
  return [
    {
      kind: "underlength",
      severity: "high",
      description: `Prose is ${wordCount} words (minimum ${minWords}) — the beat draft is too short; expand with additional description, interiority, or dialogue.`,
      metadata: { wordCount, minWords },
    },
  ]
}

/**
 * Voice-collapse detector — STUB (same contract as old repo: pairwise LLM
 * judgment, caller must not use the judge's own model family).
 */
export function detectVoiceCollapse(
  _prose: string,
  _speakingCharacters: string[],
): Promise<QualityDefect[]> {
  return Promise.resolve([])
}

/**
 * Run detectRepetition + detectUnderlength on a prose string and return the
 * combined list. Does NOT invoke detectVoiceCollapse (LLM-backed, async,
 * expensive — caller must decide whether to include it).
 */
export function detectSyncDefects(
  prose: string,
  options?: {
    minWords?: number
    repetition?: Parameters<typeof detectRepetition>[1]
  },
): QualityDefect[] {
  return [
    ...detectRepetition(prose, options?.repetition),
    ...detectUnderlength(prose, options?.minWords),
  ]
}
