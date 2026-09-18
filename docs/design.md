# 寿司打クローン as Claude Mod — 設計 / 引き継ぎメモ

作成: 2026-09-18 / 状態: 設計合意済み・未実装（spike 未実施）

## 0. これは何か

寿司打（https://sushida.net/play.html）風の日本語タイピングゲームを
**Claude Mod**（function hooks を使う Claude Code プラグイン）として実装する。
`/sushida` でトランスクリプト横のペインにゲームが開く。

成果物はこのディレクトリ（`~/projects/sushi-uchi`）を git リポジトリとして公開。
mod はマーケットプレイス経由配布が通例なので `.claude-plugin/marketplace.json` を同梱し、
`/plugin marketplace add <user>/sushi-uchi` → `/plugin install sushida@sushi-uchi` で入る形にする。

### 検討の経緯（再議論しないこと）

- 当初「単一 HTML を Artifact 公開」案で設計したが、ユーザー判断で **mod 版に変更**。HTML 版は作らない。
- 再現度は「コア＋複数ローマ字表記対応」。英単語タイピングへの縮退は却下済み。

## 1. 前提・環境

- 手元の Claude Code: **2.1.275**（function hooks は v2.1.272 以降の early access）。
- 起動に環境変数が必須: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude`
- 早期アクセスにつき **API は予告なく壊れる**。実装前に必ず最新の型定義を取り直す。
- Node v24.21.0。

### 一次情報

| 何 | どこ |
| --- | --- |
| 設計スレッド（Anthropic 公式、Mods 発表） | https://github.com/anthropics/claude-code/issues/91870 |
| 組み込み mod のソース3本 | https://github.com/anthropics/claude-code/tree/main/mods |
| 型定義（10,772 行） | https://raw.githubusercontent.com/anthropics/claude-code/main/mods/types/claude-code.d.ts |
| プラグイン配布 | https://docs.claude.com/en/docs/claude-code/plugin-marketplaces |

型定義はこのリポジトリの `types/claude-code.d.ts` に **vendor 済み**（2026-09-18 時点）。再取得は上の raw URL。

参考にする組み込み mod:
- `mods/diff` — `/diff` のペイン実装。**本件の最良の手本**（コマンド登録・ペイン開閉・`ui.render` での描画）。
  ソースは `mods/diff/hooks/register.ts`（22KB、`on(...)` が 12 箇所）と `mods/diff/hooks/views/*.tsx`。
- `mods/sec-default`、`mods/telemetry` — 小さいので構造の把握用。
- `mods/README.md` — テストの書き方（`claude plugin test <dir>`、`claude-code/testing` の `mock` / `tier`）、
  noun contract（`$` に noun を生やす場合の `types/index.d.ts` 規約）。

ローカル実行: `claude --plugin-dir sushida`（ソースから読ませる）。

## 2. API 調査結果（型定義から確認済みの事実）

### hooks モジュールの形

```ts
// hooks/hooks.json : { "description": "...", "modules": ["./register.ts"] }
export function register(on: On) {
  on('command.run', { command: 'sushida' }, async ($, e, next) => { ... })
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    const { Box, Text, Button } = await $.ui.resolve(e)
    return /* RenderElement */
  })
}
```

- ミドルウェア型（Express/Koa 風）。登録順にネストし、`next(e)` で下へ渡す。
- `$` は副作用の窓口（`$.ui` / `$.store` / `$.clock` / `$.command` / `$.process` / `$.model` など）。
  admin は `$` からメンバーを削れる＝**使えない前提のフォールバックを書く**。

### コマンド登録

`$.command.register({ name, description })` → `CommandSpec`（型定義 L1357 付近）。

### ペイン

`$.ui.open(PaneOpenArgs)`（型定義 L4901）:

| プロパティ | 意味 |
| --- | --- |
| `id` | 1〜64 文字。1 id 1 ペイン。 |
| `title` | 複数ペイン時のタブ名。 |
| `focus?: true` | **要求であって付与ではない**。空のコンポーザで prompt がキーを持っている時だけフォーカスされる。 |
| `closeOnEscape?: true` | Escape で閉じる（`ui.close` origin `person`）。フックで拒否も可。 |
| `holdToasts?: true` | ペイン表示中はトーストを溜める。 |
| `rows?: number` | インライン配置時の希望高さ。 |

描画は `on('ui.render', { component: 'Pane' })` で `e.requestId === <自分の id>` を見て木を返す。
`e.props.placement`（`dock` / `inline`）、`e.props.bodyColumns`、`e.props.scroll.bodyRows`、`e.viewport.columns` が取れる。

### 1打鍵入力 ← 最重要

**案 A: `Client` サーフェスモジュール（本命）**

`<Client key="..." module="./game.tsx" props={...} width height flexGrow />` をペインの木に置くと、
別ファイルの **surface module** が描画スレッドで動く（型定義 L1010〜1180）。

```ts
type ClientModule<P, S> = (props: P, surface: ClientSurface<S>) => RenderElement
```

`surface` が持つもの:
- `elements` — `Box` / `Text` / `Button` など（`Client` と `Raster` は入らない＝入れ子不可）
- `state` / `setState(next)` — インスタンスローカル状態。プラグインの再描画をまたいで保持される
- `columns` / `rows` — 領域サイズ
- `every(ms, fn)` — フレームクロック。**state が undefined の初回だけ張る**
- `onKey(fn)` — `ClientKeyEvent { key, ctrl?, shift?, meta? }`。`key` は特殊キー名（`up`/`return`/`backspace`…）か打った文字そのもの
- `onPointer(fn)`
- `post(data)` — hooks モジュールへ `ui.message` として送る（1フレーム1回まで）。スコア確定時に使う

`$` は Client 側に無い。外界とのやり取りは `post` と `props` のみ。
関数は時間予算内で返す必要があり、throw / 超過でインスタンスが unmount される。

**懸念（未検証）**: 型定義の `onKey` の説明が
「reached while a click has given it the focus; Escape returns that」＝**クリックでフォーカスを得ている間**とある。
ペインの `focus: true` だけでキーが届くかは不明。**ここが spike の対象**。

**案 B: `Button` の `hotkey`（フォールバック）**

`ButtonProps.hotkey` は「1 桁の数字または小文字 1 文字」で、
「バンドの Button のいずれかがフォーカスを持っている間、keydown で押される（`Shift+w` は `"w"` に一致、長押しはリピート）」。
押下は `ui.press` として hooks に届く。a〜z ＋記号ぶんの不可視 Button を敷けばフォーカス問題を回避できるが、
30 個近い Button を並べる力技で、リピート挙動や描画コストが読めない。A が駄目な時だけ。

### テスト

`claude plugin test sushida`。`claude-code/testing` から `describe / test / expect / mock / tier`。
テストは `$` と `on` を受け取り、登録したフックが mod の**下**に座る（答えない呼び出しは throw）。
`mock.clock(on)` の `advance(ms)` で `$.clock` 系の待ちを解決。`$.ui.press({ plugin, key })` で Button を押せる。
ファイル名は対象に対応（`hooks/register.ts` → `tests/register.test.ts`）、先頭で `tier('builtin')` 等。
型チェックは `tsc -p tsconfig.json`（mods 同様、`types/` と自分の `types/` を include）。

## 3. 実装設計

### ディレクトリ

```
sushi-uchi/                          # = 公開リポジトリ。マーケットプレイス兼用
  .claude-plugin/marketplace.json
  types/claude-code.d.ts             # vendor 済み（取得: 2026-09-18）
  docs/design.md                     # このファイル
  sushida/                           # プラグイン本体
    .claude-plugin/plugin.json
    hooks/hooks.json                 # { "modules": ["./register.ts"] }
    hooks/register.ts                # コマンド・ペイン開閉・ui.render・ui.message・ハイスコア
    hooks/game.tsx                   # Client サーフェスモジュール（状態機・onKey・every・描画）
    hooks/romaji/                    # かな→ローマ字オートマトン（純関数、$ 非依存）
    hooks/words.ts                   # お題 60 語 { display, kana }
    tests/romaji.test.ts
    tests/register.test.ts
  README.md
```

`diff` mod の流儀に倣う: 1 関数 1 ディレクトリ ＋ `index.ts` で再 export、`import type … from 'claude-code'`、
`.tsx` の先頭に `/* @jsxRuntime classic */ /* @jsx h */ /* @jsxFrag Fragment */`。

### 責務分割

- `hooks/register.ts` — `$` を触る唯一の層。`/sushida` 登録、ペイン開閉、`ui.render` で `<Client>` を返す、
  `ui.message` でスコアを受けて `$.store` にハイスコア保存、次の props で Client に返す。
- `hooks/game.tsx` — ゲーム本体。`$` 非依存。`surface.state` に全状態、`onKey` で遷移、`every(120ms)` で時間と皿送り。
- `hooks/romaji/` — **純関数**。UI も状態も持たない。ここだけで単体テストが完結する。

### ローマ字オートマトン（実装の主コスト）

お題は「かな列」で保持し、1 文字入力ごとに「受理可能な次文字集合」を計算して照合する
（確定済みバッファ ＋ 残りかな列 → 次に許す文字集合）。

許容する揺れ:
- `し` = si / shi / ci、`ち` = ti / chi、`つ` = tu / tsu、`ふ` = hu / fu、`じ` = zi / ji
- `ん` = n / nn / xn。ただし**次が母音・な行・や行・末尾なら `n` 単独は不可**
- `っ` = 次の子音重ね / xtu / ltu
- 拗音 `きゃ` = kya / kixya / kilya
- `ー`、句読点

**TDD で最初に完成させる**。テストケース例: `しゃっきん` → `syakkinn` / `shakkin` / `syakkin` いずれも受理。

### ゲーム仕様

- 状態機: `title → countdown → playing → result`
- コース（Button ＋ `hotkey` `1` / `2` / `3`）: お手軽 3,000 円 60 秒 / おすすめ 5,000 円 90 秒 / 高級 10,000 円 120 秒
- **全体タイマー 1 本**（皿ごとの制限時間は無し＝本家準拠）。1 皿 = 1 お題、打ち切ると次の皿へ。単価はお題の長さで変動
- ミスタイプはカウントのみ、時間ペナルティ無し（本家準拠）
- 表示: 上段にレーンを流れる 🍣（`every(120ms)` で 1 セル送り）／中段にお題（漢字表記＋かな＋ローマ字ガイド、
  確定分をハイライト・次打鍵を強調）／下段に残り時間バーと金額カウンタ
- 結果: 食べた金額 vs コース料金で「元を取った／損した」、正打数・ミス数・平均キー/秒・苦手キー
- ハイスコアは `$.store`。ペインは `focus: true, closeOnEscape: true, holdToasts: true` で開く
- お題 60 語を内蔵、外部通信なし

## 4. 次のセッションの進め方

1. **spike（最優先・これで方式が決まる）** — ペインに `<Client>` を 1 枚出し、`onKey` で拾ったキーをそのまま描く最小 mod を書き、
   `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir sushida` で起動。
   **ペインの focus だけでキーが届くか／クリックが要るか**を確認する。届けば案 A、駄目なら案 B（hotkey Button）へ。
   spike のコードは捨てる前提。
2. ローマ字オートマトンを TDD（`tests/romaji.test.ts` 先行）
3. `hooks/game.tsx`（描画と状態機）
4. `hooks/register.ts`（コマンド・ペイン・ハイスコア）＋ `tests/register.test.ts`
5. `README.md` と `.claude-plugin/marketplace.json`、git init して公開

## 5. 未決事項

- 入力方式 A / B（spike で決める）
- GitHub の公開先アカウント / リポジトリ名（`sushi-uchi` 想定）
- お題 60 語の中身（実装時に用意）
