/**
 * かな1文字（拗音は「きゃ」のように2文字）に対する許容ローマ字表記の集合。
 */
export type KanaRomaji = {
  readonly kana: string
  readonly romaji: readonly string[]
}

/**
 * オートマトンの状態: 確定済みの入力文字列と、まだ打っていないかな列。
 */
export type RomajiState = {
  readonly typed: string
  readonly remainingKana: string
}

/**
 * 1文字の入力を受理した結果。
 */
export type RomajiStepResult =
  | { readonly ok: true; readonly state: RomajiState; readonly isComplete: boolean }
  | { readonly ok: false }
