import { YOUON_BASE_KANA, youonKindOf } from './kana-table.ts'

/**
 * かな列を「1打鍵単位」に分割する。拗音（きゃ等）は2文字1トークン、
 * それ以外（促音っ・撥音ん・長音ー・通常のかな）は1文字1トークン。
 */
export function tokenizeKana(kana: string): string[] {
  const tokens: string[] = []
  const chars = Array.from(kana)

  for (let i = 0; i < chars.length; i += 1) {
    const current = chars[i]!
    const next = chars[i + 1]

    if (next !== undefined && YOUON_BASE_KANA.has(current) && youonKindOf(next) !== undefined) {
      tokens.push(current + next)
      i += 1
      continue
    }

    tokens.push(current)
  }

  return tokens
}
