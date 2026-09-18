/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { On, RenderElement } from 'claude-code'

import type { GameResultMessage } from './game'

const PANE_ID = 'sushida'
const PANE_TITLE = '寿司打'
const COMMAND_NAME = 'sushida'
const HIGH_SCORE_KEY = 'sushida:high-score'

/**
 * `/sushida`: 寿司打クローンのペインを開く。ゲーム本体は Client サーフェス
 * モジュール（`game.tsx`）が担う。この register.tsx は `$` を触る唯一の層。
 *
 * @param on the engine's registrar
 */
export function register(on: On) {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: COMMAND_NAME,
        description: '寿司打クローンのタイピングゲームを開く',
      })
    } catch {
      // 既に built-in 等が同名コマンドを持つ場合は無視する
    }

    return next(e)
  })

  on('command.run', { command: COMMAND_NAME }, async ($) => {
    await $.ui.open({
      id: PANE_ID,
      title: PANE_TITLE,
      focus: true,
      closeOnEscape: true,
      holdToasts: true,
    })

    return {}
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE_ID) {
      return next(e)
    }

    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      const { Box, Text } = $.ui.resolve(e)
      return (
        <Box>
          <Text dimColor>この画面では寿司打を表示できません</Text>
        </Box>
      ) as RenderElement
    }

    const { Box, Client } = $.ui.resolve(e)
    const highScore = Number((await $.store.get(HIGH_SCORE_KEY)) ?? 0) || undefined

    return (
      <Box flexGrow={1}>
        <Client key="game" module="./game.tsx" props={{ highScore }} flexGrow={1} />
      </Box>
    ) as RenderElement
  })

  on('ui.message', async ($, e, next) => {
    if (e.requestId !== PANE_ID || e.element !== 'game') {
      return next(e)
    }

    const data = e.data as GameResultMessage | undefined

    if (data !== undefined && data.kind === 'result') {
      const stored = Number((await $.store.get(HIGH_SCORE_KEY)) ?? 0)
      if (data.money > stored) {
        await $.store.set(HIGH_SCORE_KEY, data.money)
      }
    }

    const highScore = Number((await $.store.get(HIGH_SCORE_KEY)) ?? 0) || undefined

    return { props: { highScore } }
  })
}
