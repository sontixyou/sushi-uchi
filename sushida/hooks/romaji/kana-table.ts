/**
 * 単独かな（拗音・促音・撥音・長音を除く）のローマ字候補表。
 * 揺れは全て列挙する（例: し = si/shi/ci）。
 */
export const BASE_ROMAJI: Readonly<Record<string, readonly string[]>> = {
  あ: ['a'], い: ['i'], う: ['u'], え: ['e'], お: ['o'],
  か: ['ka'], き: ['ki'], く: ['ku'], け: ['ke'], こ: ['ko'],
  さ: ['sa'], し: ['si', 'shi', 'ci'], す: ['su'], せ: ['se'], そ: ['so'],
  た: ['ta'], ち: ['ti', 'chi'], つ: ['tu', 'tsu'], て: ['te'], と: ['to'],
  な: ['na'], に: ['ni'], ぬ: ['nu'], ね: ['ne'], の: ['no'],
  は: ['ha'], ひ: ['hi'], ふ: ['hu', 'fu'], へ: ['he'], ほ: ['ho'],
  ま: ['ma'], み: ['mi'], む: ['mu'], め: ['me'], も: ['mo'],
  や: ['ya'], ゆ: ['yu'], よ: ['yo'],
  ら: ['ra'], り: ['ri'], る: ['ru'], れ: ['re'], ろ: ['ro'],
  わ: ['wa'], を: ['wo'],
  が: ['ga'], ぎ: ['gi'], ぐ: ['gu'], げ: ['ge'], ご: ['go'],
  ざ: ['za'], じ: ['zi', 'ji'], ず: ['zu'], ぜ: ['ze'], ぞ: ['zo'],
  だ: ['da'], ぢ: ['di'], づ: ['du'], で: ['de'], ど: ['do'],
  ば: ['ba'], び: ['bi'], ぶ: ['bu'], べ: ['be'], ぼ: ['bo'],
  ぱ: ['pa'], ぴ: ['pi'], ぷ: ['pu'], ぺ: ['pe'], ぽ: ['po'],
  ー: ['-'],
  '、': [','], '。': ['.'],
} as const

/**
 * 拗音（きゃ等）を構成できる「い段」かな。この集合に属するかなの直後に
 * 小書きの ゃ/ゅ/ょ が続くと、拗音として1トークンにまとめられる。
 */
export const YOUON_BASE_KANA = new Set([
  'き', 'し', 'ち', 'に', 'ひ', 'み', 'り', 'ぎ', 'じ', 'ぢ', 'び', 'ぴ',
])

/**
 * 拗音の直接表記（きゃ = kya 等）。デコンポーズ表記（ki + xya/lya = kixya/kilya）は
 * BASE_ROMAJI のステムから自動生成する。
 */
export const YOUON_DIRECT: Readonly<Record<string, { ya: readonly string[]; yu: readonly string[]; yo: readonly string[] }>> = {
  き: { ya: ['kya'], yu: ['kyu'], yo: ['kyo'] },
  し: { ya: ['sya', 'sha'], yu: ['syu', 'shu'], yo: ['syo', 'sho'] },
  ち: { ya: ['tya', 'cha'], yu: ['tyu', 'chu'], yo: ['tyo', 'cho'] },
  に: { ya: ['nya'], yu: ['nyu'], yo: ['nyo'] },
  ひ: { ya: ['hya'], yu: ['hyu'], yo: ['hyo'] },
  み: { ya: ['mya'], yu: ['myu'], yo: ['myo'] },
  り: { ya: ['rya'], yu: ['ryu'], yo: ['ryo'] },
  ぎ: { ya: ['gya'], yu: ['gyu'], yo: ['gyo'] },
  じ: { ya: ['zya', 'ja'], yu: ['zyu', 'ju'], yo: ['zyo', 'jo'] },
  ぢ: { ya: ['dya'], yu: ['dyu'], yo: ['dyo'] },
  び: { ya: ['bya'], yu: ['byu'], yo: ['byo'] },
  ぴ: { ya: ['pya'], yu: ['pyu'], yo: ['pyo'] },
}

const YOUON_SMALL_KANA: Readonly<Record<string, 'ya' | 'yu' | 'yo'>> = {
  ゃ: 'ya', ゅ: 'yu', ょ: 'yo',
}

export function youonKindOf(smallKana: string): 'ya' | 'yu' | 'yo' | undefined {
  return YOUON_SMALL_KANA[smallKana]
}

/**
 * `ん` の直後（次のかなユニット）が母音・な行・や行なら、単独の `n` は
 * 次のかなに吸収され曖昧になるため許容しない（`nn` / `xn` のみ許容）。
 * 語末（次のかなが無い）は単独 `n` を許容する。
 */
const VOWEL_KANA = new Set(['あ', 'い', 'う', 'え', 'お'])
const NA_ROW_KANA = new Set(['な', 'に', 'ぬ', 'ね', 'の', 'にゃ', 'にゅ', 'にょ'])
const YA_ROW_KANA = new Set(['や', 'ゆ', 'よ'])

export function bareNIsAmbiguousBefore(nextKanaUnit: string | undefined): boolean {
  if (nextKanaUnit === undefined) return false
  return VOWEL_KANA.has(nextKanaUnit) || NA_ROW_KANA.has(nextKanaUnit) || YA_ROW_KANA.has(nextKanaUnit)
}
