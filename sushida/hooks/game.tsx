/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { ClientElements, ClientKeyEvent, ClientModule, RenderElement } from 'claude-code'

import { acceptChar, createRomajiState, type RomajiState } from './romaji/index.ts'
import { WORDS } from './words.ts'

const TICK_MS = 120
const COUNTDOWN_SECONDS = 3
const YEN_PER_KANA = 50

const COURSES = [
  { label: 'お手軽', price: 3000, seconds: 60 },
  { label: 'おすすめ', price: 5000, seconds: 90 },
  { label: '高級', price: 10000, seconds: 120 },
] as const

function courseOf(index: number): (typeof COURSES)[number] {
  return COURSES[index]!
}

function wordOf(index: number): (typeof WORDS)[number] {
  return WORDS[index]!
}

type Phase = 'title' | 'countdown' | 'playing' | 'result'

type CurrentPlate = {
  readonly wordIndex: number
  readonly romaji: RomajiState
  readonly typed: string
}

type GameState = {
  readonly phase: Phase
  readonly courseIndex: number
  readonly countdownMs: number
  readonly remainingMs: number
  readonly laneOffset: number
  readonly wordOrder: readonly number[]
  readonly wordCursor: number
  readonly current: CurrentPlate
  readonly money: number
  readonly correctKeystrokes: number
  readonly missKeystrokes: number
  readonly missByChar: Readonly<Record<string, number>>
  readonly hasPostedResult: boolean
}

export type GameProps = {
  readonly highScore?: number
}

export type GameResultMessage = {
  readonly kind: 'result'
  readonly money: number
  readonly coursePrice: number
  readonly correctKeystrokes: number
  readonly missKeystrokes: number
}

function shuffledIndices(length: number): number[] {
  const indices = Array.from({ length }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = indices[i]!
    indices[i] = indices[j]!
    indices[j] = tmp
  }
  return indices
}

function drawPlate(wordOrder: readonly number[], wordCursor: number): { wordIndex: number; wordOrder: readonly number[]; wordCursor: number } {
  if (wordCursor >= wordOrder.length) {
    const reshuffled = shuffledIndices(WORDS.length)
    return { wordIndex: reshuffled[0]!, wordOrder: reshuffled, wordCursor: 1 }
  }
  return { wordIndex: wordOrder[wordCursor]!, wordOrder, wordCursor: wordCursor + 1 }
}

function newPlate(wordIndex: number): CurrentPlate {
  return { wordIndex, romaji: createRomajiState(wordOf(wordIndex).kana), typed: '' }
}

function initialState(): GameState {
  const wordOrder = shuffledIndices(WORDS.length)
  return {
    phase: 'title',
    courseIndex: 0,
    countdownMs: COUNTDOWN_SECONDS * 1000,
    remainingMs: 0,
    laneOffset: 0,
    wordOrder,
    wordCursor: 1,
    current: newPlate(wordOrder[0]!),
    money: 0,
    correctKeystrokes: 0,
    missKeystrokes: 0,
    missByChar: {},
    hasPostedResult: false,
  }
}

function tick(state: GameState): GameState {
  if (state.phase === 'countdown') {
    const countdownMs = state.countdownMs - TICK_MS
    if (countdownMs <= 0) {
      return {
        ...state,
        phase: 'playing',
        countdownMs: 0,
        remainingMs: courseOf(state.courseIndex).seconds * 1000,
      }
    }
    return { ...state, countdownMs }
  }

  if (state.phase === 'playing') {
    const remainingMs = state.remainingMs - TICK_MS
    const laneOffset = state.laneOffset + 1
    if (remainingMs <= 0) {
      return { ...state, phase: 'result', remainingMs: 0, laneOffset }
    }
    return { ...state, remainingMs, laneOffset }
  }

  return state
}

function startCourse(state: GameState, courseIndex: number): GameState {
  if (state.phase !== 'title') return state
  return { ...state, courseIndex, phase: 'countdown', countdownMs: COUNTDOWN_SECONDS * 1000 }
}

function restartToTitle(): GameState {
  return initialState()
}

function handleTypingKey(state: GameState, char: string): GameState {
  const result = acceptChar(state.current.romaji, char)

  if (!result.ok) {
    const missByChar = { ...state.missByChar, [char]: (state.missByChar[char] ?? 0) + 1 }
    return { ...state, missKeystrokes: state.missKeystrokes + 1, missByChar }
  }

  const current: CurrentPlate = { ...state.current, romaji: result.state, typed: result.state.typed }
  const afterKeystroke = { ...state, current, correctKeystrokes: state.correctKeystrokes + 1 }

  if (!result.isComplete) {
    return afterKeystroke
  }

  const word = wordOf(state.current.wordIndex)
  const money = afterKeystroke.money + word.kana.length * YEN_PER_KANA
  const drawn = drawPlate(state.wordOrder, state.wordCursor)

  return {
    ...afterKeystroke,
    money,
    wordOrder: drawn.wordOrder,
    wordCursor: drawn.wordCursor,
    current: newPlate(drawn.wordIndex),
  }
}

function handleKey(state: GameState, event: ClientKeyEvent): GameState {
  if (event.ctrl === true || event.meta === true) return state

  if (state.phase === 'title') {
    if (event.key === '1') return startCourse(state, 0)
    if (event.key === '2') return startCourse(state, 1)
    if (event.key === '3') return startCourse(state, 2)
    return state
  }

  if (state.phase === 'result') {
    if (event.key === 'r' || event.key === 'R') return restartToTitle()
    return state
  }

  if (state.phase === 'playing') {
    if (event.key.length === 1 && /^[a-z-]$/.test(event.key)) {
      return handleTypingKey(state, event.key)
    }
    return state
  }

  return state
}

function formatSeconds(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(1)
}

function sushiLane(offset: number, columns: number): string {
  const laneWidth = Math.max(10, columns - 4)
  const cells: string[] = []
  for (let i = 0; i < laneWidth; i += 1) {
    cells.push((i + offset) % 4 === 0 ? '🍣' : '　')
  }
  return cells.join('')
}

function worstChar(missByChar: Readonly<Record<string, number>>): string | undefined {
  let worst: string | undefined
  let worstCount = 0
  for (const [char, count] of Object.entries(missByChar)) {
    if (count > worstCount) {
      worst = char
      worstCount = count
    }
  }
  return worst
}

function renderTitle(ui: ClientElements, props: GameProps): RenderElement {
  const { Box, Text } = ui
  return (
    <Box flexDirection="column">
      <Text bold>寿司打</Text>
      <Text>コースを選んでください（数字キー）</Text>
      <Box flexDirection="column" marginTop={1}>
        {COURSES.map((course, index) => (
          <Text key={`course-${index}`}>
            {index + 1}: {course.label}（{course.price}円 / {course.seconds}秒）
          </Text>
        ))}
      </Box>
      {props.highScore !== undefined && <Text dimColor>ハイスコア: {props.highScore}円</Text>}
      <Box marginTop={1}>
        <Text dimColor>キー入力が効かない場合はこのペインをクリックしてから数字キーを押してください</Text>
      </Box>
    </Box>
  )
}

function renderCountdown(ui: ClientElements, state: GameState): RenderElement {
  const { Box, Text } = ui
  const seconds = Math.ceil(state.countdownMs / 1000)
  return (
    <Box flexDirection="column">
      <Text bold>{courseOf(state.courseIndex).label}コース</Text>
      <Text>{seconds > 0 ? seconds : 'スタート！'}</Text>
    </Box>
  )
}

function renderPlaying(ui: ClientElements, state: GameState, columns: number): RenderElement {
  const { Box, Text } = ui
  const word = wordOf(state.current.wordIndex)
  const typed = state.current.typed
  const course = courseOf(state.courseIndex)
  const remainRatio = course.seconds > 0 ? state.remainingMs / (course.seconds * 1000) : 0
  const barWidth = Math.max(10, columns - 10)
  const filled = Math.round(barWidth * Math.max(0, Math.min(1, remainRatio)))

  return (
    <Box flexDirection="column">
      <Text>{sushiLane(state.laneOffset, columns)}</Text>
      <Box flexDirection="column" marginTop={1}>
        <Text bold>{word.display}</Text>
        <Text dimColor>{word.kana}</Text>
        <Text>
          <Text color="green">{typed}</Text>
        </Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text>{'▓'.repeat(filled) + '░'.repeat(Math.max(0, barWidth - filled))}</Text>
        <Text>
          残り {formatSeconds(state.remainingMs)}秒 / {state.money}円
        </Text>
      </Box>
    </Box>
  )
}

function renderResult(ui: ClientElements, state: GameState, props: GameProps): RenderElement {
  const { Box, Text } = ui
  const course = courseOf(state.courseIndex)
  const diff = state.money - course.price
  const totalKeystrokes = state.correctKeystrokes + state.missKeystrokes
  const speed = course.seconds > 0 ? (state.correctKeystrokes / course.seconds).toFixed(2) : '0'
  const weakChar = worstChar(state.missByChar)
  const isProfit = diff >= 0

  return (
    <Box flexDirection="column">
      <Text bold>結果</Text>
      <Text>
        食べた金額: {state.money}円 / コース料金: {course.price}円
      </Text>
      <Text color={isProfit ? 'green' : 'red'}>
        {isProfit ? `${diff}円分、元を取りました！` : `${-diff}円分、損しました…`}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        <Text>
          正打数: {state.correctKeystrokes} / ミス数: {state.missKeystrokes} / 総打鍵: {totalKeystrokes}
        </Text>
        <Text>平均キー/秒: {speed}</Text>
        {weakChar !== undefined && <Text>苦手キー: {weakChar}</Text>}
        {props.highScore !== undefined && <Text dimColor>ハイスコア: {Math.max(props.highScore, state.money)}円</Text>}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Rキーでもう一度</Text>
      </Box>
    </Box>
  )
}

function render(ui: ClientElements, state: GameState, props: GameProps, columns: number): RenderElement {
  const { Box } = ui

  if (state.phase === 'title') return renderTitle(ui, props)
  if (state.phase === 'countdown') return renderCountdown(ui, state)
  if (state.phase === 'playing') return renderPlaying(ui, state, columns)
  return <Box flexDirection="column">{renderResult(ui, state, props)}</Box>
}

/**
 * `every`/`onKey` は初回登録の1回きり。以降のtick/keyでも最新のstateを
 * 読み書きできるよう、インスタンス単位のミュータブルセルをモジュールスコープに持つ
 * （1ペイン1ゲームインスタンスの前提。同時に複数走らせない）。
 */
let latestState: GameState | undefined

const GameModule: ClientModule<GameProps, GameState> = (props, surface) => {
  const { elements, state, setState, onKey, every, post, columns } = surface

  if (state === undefined) {
    const initial = initialState()
    latestState = initial
    setState(initial)

    every(TICK_MS, () => {
      if (latestState === undefined) return
      const next = tick(latestState)
      latestState = next
      setState(next)
    })

    onKey(event => {
      if (latestState === undefined) return
      const next = handleKey(latestState, event)
      latestState = next
      setState(next)
    })

    return render(elements, initial, props, columns)
  }

  latestState = state

  if (state.phase === 'result' && !state.hasPostedResult) {
    const course = courseOf(state.courseIndex)
    const message: GameResultMessage = {
      kind: 'result',
      money: state.money,
      coursePrice: course.price,
      correctKeystrokes: state.correctKeystrokes,
      missKeystrokes: state.missKeystrokes,
    }
    post(message)
    const posted = { ...state, hasPostedResult: true }
    latestState = posted
    setState(posted)
    return render(elements, posted, props, columns)
  }

  return render(elements, state, props, columns)
}

export default GameModule
