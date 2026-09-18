import { candidatesOf } from './candidates.ts'
import { tokenizeKana } from './tokenize.ts'
import type { RomajiState, RomajiStepResult } from './types.ts'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz-'.split('')

function tokenCandidates(kana: string): readonly (readonly string[])[] {
  return candidatesOf(tokenizeKana(kana))
}

/**
 * `input` が、`tokens[tokenIndex..]` の候補を連結したいずれかの文字列の
 * "接頭辞" として成立するかを判定する（`input` が空なら常に成立）。
 */
function isValidPrefix(tokens: readonly (readonly string[])[], tokenIndex: number, input: string): boolean {
  if (input.length === 0) return true
  if (tokenIndex >= tokens.length) return false

  for (const candidate of tokens[tokenIndex]!) {
    if (candidate.startsWith(input)) return true
    if (input.startsWith(candidate) && isValidPrefix(tokens, tokenIndex + 1, input.slice(candidate.length))) {
      return true
    }
  }

  return false
}

/**
 * `input` が `tokens` の連結として過不足なく一致するか（打ち切り＝完成）。
 */
function isExactMatch(tokens: readonly (readonly string[])[], tokenIndex: number, input: string): boolean {
  if (tokenIndex === tokens.length) return input.length === 0

  for (const candidate of tokens[tokenIndex]!) {
    if (input.startsWith(candidate) && isExactMatch(tokens, tokenIndex + 1, input.slice(candidate.length))) {
      return true
    }
  }

  return false
}

export function createRomajiState(kana: string): RomajiState {
  return { typed: '', remainingKana: kana }
}

/**
 * 1文字 `char` を打った結果を返す。受理できない場合 `{ ok: false }`。
 */
export function acceptChar(state: RomajiState, char: string): RomajiStepResult {
  const tokens = tokenCandidates(state.remainingKana)
  const nextTyped = state.typed + char

  if (!isValidPrefix(tokens, 0, nextTyped)) {
    return { ok: false }
  }

  const nextState: RomajiState = { typed: nextTyped, remainingKana: state.remainingKana }
  return { ok: true, state: nextState, isComplete: isExactMatch(tokens, 0, nextTyped) }
}

/**
 * 次に受理される文字の集合。空集合なら（バグでない限り）既に完成している。
 */
export function nextAcceptableChars(state: RomajiState): readonly string[] {
  const tokens = tokenCandidates(state.remainingKana)
  return ALPHABET.filter(char => isValidPrefix(tokens, 0, state.typed + char))
}

export function isComplete(state: RomajiState): boolean {
  const tokens = tokenCandidates(state.remainingKana)
  return isExactMatch(tokens, 0, state.typed)
}
