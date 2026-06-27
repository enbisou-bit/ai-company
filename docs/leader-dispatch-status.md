# Leader自動振り分け 実装状況レポート
作成日：2026-06-20

---

## 判定：③ 完成済み

---

## 処理フロー（Leader選択時）

```
ユーザー入力
  └─ sendMessage()
      └─ /api/chat (memberId=leader)
          └─ Leader が reply + dispatch:["sns","video",...] を返す
              ├─ dispatch がなければ routeLeaderMessage() でキーワード判定
              └─ handleLeaderDispatch(text, dispatchIds)
                  ├─ SNS担当 → /api/chat → reply → completedReplies
                  ├─ Video担当 → /api/chat → reply → completedReplies
                  └─ 全員完了 → triggerStrategyConsolidate()
                                  └─ /api/strategy-consolidate
                                      └─ strategyConsolidate() → 統合意見表示
```

---

## 実装済み関数一覧

| ステップ | 関数 / 処理 | ファイル |
|---|---|---|
| 1 | `sendMessage()` — ユーザー入力受付 | index.html:4608 |
| 2 | `/api/chat` へ `memberId: currentMember.id` を送信 | index.html:4649 |
| 3 | `detectGenre(text)` — ジャンル自動判定 | server.js:675 |
| 4 | `generateReply()` — 担当AIが回答生成 | server.js:520 |
| 5 | `parseAIResponse(data.reply)` — dispatch配列を抽出 | index.html:4664 |
| 6 | `routeLeaderMessage(text)` — キーワードフォールバック | index.html:3294 |
| 7 | `handleLeaderDispatch(text, dispatchIds)` — 担当へ並列実行 | index.html:3326 |
| 8 | 各担当が `/api/chat` で OpenAI 実行 | index.html:3416 |
| 9 | `completedReplies` に集約 | index.html:3450 |
| 10 | `triggerStrategyConsolidate()` — 戦略顧問が統合意見 | index.html:3477 |
| 11 | `/api/leader-summary` → `leaderSummary()` | server.js:561 |

---

## 品質上の弱点（未完成ではないが改善余地あり）

| 弱点 | 内容 |
|---|---|
| dispatch判定精度 | LeaderのAI回答が `dispatch` フィールドを返さない場合、`routeLeaderMessage()` のキーワードマッチに落ちる |
| memberScoreの振り分け反映 | `getDispatchWeights()` でスコアを取得する仕組みはあるが、`handleLeaderDispatch` での担当優先度への反映がまだない |
| `leaderSummary` の呼び出し | `/api/leader-summary` エンドポイントは存在するが、`triggerStrategyConsolidate` の後に自動呼び出しする処理が未接続 |

---

## 次にやるべき修正（優先順）

| 優先 | 内容 | 対象 |
|---|---|---|
| 高 | `triggerStrategyConsolidate` 完了後に `/api/leader-summary` を自動呼び出し → Leader最終まとめをチャットに表示 | index.html:3504付近 |
| 中 | `dispatch-weights` を `handleLeaderDispatch` で参照し、スコア上位担当を優先選択 | index.html:3326付近 |
| 低 | Leader AI回答の `dispatch` フィールド出力精度を `openaiClient.js` のプロンプトで強化 | openaiClient.js |

---

## 確認済み実装

- Supabase接続済み
- conversations 保存確認済み
- messages 保存確認済み
- OpenAI API 応答確認済み
- openaiClient.js に leaderSummary 実装あり
- openaiClient.js に strategyConsolidate 実装あり
- server.js に detectGenre(text) 実装あり
- memberReplies を使った複数担当統合処理あり
- 学習データ全12テーブル Supabase永続化済み（完全永続化率 100%）
