# sushi-uchi

寿司打風の日本語タイピングゲームを `/sushida` で開く Claude Code mod（`sushida`）。

## インストール

```
/plugin marketplace add <user>/sushi-uchi
/plugin install sushida@sushi-uchi
```

ソースから直接読ませる場合（開発時）:

```
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir sushida
```

function hooks は早期アクセス機能のため、起動には環境変数 `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` が必要。

## 使い方

1. `/sushida` でペインを開く
2. キー入力が効かない場合はペインをクリックしてフォーカスしてから操作する
3. `1`/`2`/`3` でコースを選択（お手軽3,000円60秒 / おすすめ5,000円90秒 / 高級10,000円120秒）
4. 表示されたお題をローマ字で入力する（`し`=si/shi/ci など複数表記の揺れに対応）
5. 制限時間内に食べた金額でコース料金を元が取れたか競う
6. 結果画面で `R` を押すともう一度プレイできる

`Esc` でペインを閉じる。ハイスコアはセッションをまたいで保存される。

## 開発

```
cd sushida
npm install
npm test        # ローマ字オートマトンのテスト
npm run typecheck
```

設計の詳細は `docs/design.md` を参照。
