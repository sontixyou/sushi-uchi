import { bareNIsAmbiguousBefore, BASE_ROMAJI, YOUON_DIRECT, youonKindOf } from './kana-table.ts'

const VOWEL_START = new Set(['a', 'i', 'u', 'e', 'o'])

function romajiOfPlainToken(token: string): readonly string[] {
  const chars = Array.from(token)

  if (chars.length === 2) {
    const base = chars[0]!
    const small = chars[1]!
    const kind = youonKindOf(small)
    const direct = YOUON_DIRECT[base]

    if (kind !== undefined && direct !== undefined) {
      const stems = BASE_ROMAJI[base] ?? []
      const suffix = kind === 'ya' ? ['xya', 'lya'] : kind === 'yu' ? ['xyu', 'lyu'] : ['xyo', 'lyo']
      const decomposed = stems.flatMap(stem => suffix.map(s => stem + s))

      return [...direct[kind], ...decomposed]
    }
  }

  return BASE_ROMAJI[token] ?? []
}

/**
 * 促音「っ」の候補: 次トークンの子音を重ねた形（子音始まりの候補のみ）＋ xtu/ltu。
 */
function romajiOfSokuon(nextToken: string | undefined): readonly string[] {
  const doubled = new Set<string>()

  if (nextToken !== undefined) {
    for (const candidate of romajiOfPlainToken(nextToken)) {
      const first = candidate[0]
      if (first !== undefined && !VOWEL_START.has(first)) {
        doubled.add(first)
      }
    }
  }

  return [...doubled, 'xtu', 'ltu']
}

/**
 * 撥音「ん」の候補: n / nn / xn。次のかなが母音・な行・や行なら単独 n は不可。
 */
function romajiOfHatsuon(nextToken: string | undefined): readonly string[] {
  const base = ['nn', 'xn']
  return bareNIsAmbiguousBefore(nextToken) ? base : ['n', ...base]
}

/**
 * トークン列の各要素について、許容ローマ字候補の配列を返す。
 * っ・ん は前後関係（次トークン）に依存するためここでまとめて解決する。
 */
export function candidatesOf(tokens: readonly string[]): readonly (readonly string[])[] {
  return tokens.map((token, index) => {
    const next = tokens[index + 1]

    if (token === 'っ') return romajiOfSokuon(next)
    if (token === 'ん') return romajiOfHatsuon(next)

    return romajiOfPlainToken(token)
  })
}
