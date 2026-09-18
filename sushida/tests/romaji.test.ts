import assert from 'node:assert/strict'
import { test } from 'node:test'

import { acceptChar, createRomajiState, isComplete, nextAcceptableChars } from '../hooks/romaji/index.ts'

/**
 * `kana` に対して `input` を1文字ずつ打ち、最後まで受理されて完成するかを返す。
 * 途中で拒否された文字があれば false。
 */
function typeAll(kana: string, input: string): boolean {
  let state = createRomajiState(kana)

  for (const char of input) {
    const result = acceptChar(state, char)
    if (!result.ok) return false
    state = result.state
  }

  return isComplete(state)
}

test('単純なかな1文字', () => {
  assert.equal(typeAll('あ', 'a'), true)
  assert.equal(typeAll('か', 'ka'), true)
  assert.equal(typeAll('か', 'ta'), false)
})

test('し/ち/つ/ふ/じ の複数表記揺れ', () => {
  for (const word of ['si', 'shi', 'ci']) assert.equal(typeAll('し', word), true, word)
  for (const word of ['ti', 'chi']) assert.equal(typeAll('ち', word), true, word)
  for (const word of ['tu', 'tsu']) assert.equal(typeAll('つ', word), true, word)
  for (const word of ['hu', 'fu']) assert.equal(typeAll('ふ', word), true, word)
  for (const word of ['zi', 'ji']) assert.equal(typeAll('じ', word), true, word)
})

test('拗音: 直接表記とデコンポーズ表記', () => {
  for (const word of ['kya', 'kixya', 'kilya']) {
    assert.equal(typeAll('きゃ', word), true, word)
  }
  assert.equal(typeAll('しゃ', 'sha'), true)
  assert.equal(typeAll('しゃ', 'sya'), true)
  assert.equal(typeAll('しゃ', 'shixya'), true)
  assert.equal(typeAll('じょ', 'jo'), true)
  assert.equal(typeAll('じょ', 'zyo'), true)
})

test('促音: 次の子音を重ねる、または xtu/ltu', () => {
  assert.equal(typeAll('がっこう', 'gakkou'), true)
  assert.equal(typeAll('がっこう', 'gaxtukou'), true)
  assert.equal(typeAll('がっこう', 'galtukou'), true)
  assert.equal(typeAll('まって', 'matte'), true)
})

test('撥音ん: n/nn/xn、次が母音・な行・や行なら単独n不可', () => {
  assert.equal(typeAll('けんこう', 'kennkou'), true)
  assert.equal(typeAll('けんこう', 'kenkou'), true, '次が子音（こ）なら単独nでOK')
  assert.equal(typeAll('かんい', 'kanni'), true)
  assert.equal(typeAll('かんい', 'kani'), false, '次が母音なので単独nは不可')
  assert.equal(typeAll('かんな', 'kannna'), true)
  assert.equal(typeAll('かんな', 'kanna'), false, '次がな行なので単独nは不可')
})

test('撥音ん: 語末は単独nを許容する（設計例と整合）', () => {
  assert.equal(typeAll('しゃっきん', 'syakkinn'), true)
  assert.equal(typeAll('しゃっきん', 'shakkin'), true)
  assert.equal(typeAll('しゃっきん', 'syakkin'), true)
})

test('長音・句読点', () => {
  assert.equal(typeAll('らーめん', 'ra-menn'), true)
  assert.equal(typeAll('らーめん', 'ra-men'), true)
  assert.equal(typeAll('らーめん', 'ramen'), false, '長音符の省略は受理しない')
})

test('途中の誤り: 想定外の文字は拒否される', () => {
  const state0 = createRomajiState('か')
  const result = acceptChar(state0, 'x')
  assert.equal(result.ok, false)
})

test('nextAcceptableChars: 次に許される文字集合を返す', () => {
  const state = createRomajiState('し')
  const accepted = nextAcceptableChars(state)
  assert.ok(accepted.includes('s'))
  assert.ok(accepted.includes('c'))
  assert.ok(!accepted.includes('k'))
})
