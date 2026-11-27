# タスクリスト（進捗管理）

最終更新: 2026-11-27

> **進捗の一元化ルール**: すべての成果物はこのリポジトリの main に入れる。外部ツール（Antigravity等）の成果も同様。リポジトリに無いものは「未完了」とみなす。
凡例: `[ ]` 未着手 / `[~]` 進行中 / `[x]` 完了 / `[!]` ブロック中（理由を併記）
担当は roles.md の役割名。タスク完了時は担当者がこのファイルを更新する。

## 進捗サマリ

| フェーズ | 担当グループ | 進捗 |
|---|---|---|
| 0. 要件定義 | 統括 | 🟡 進行中（未決事項あり） |
| 1. 設計 | A. 設計 | 🟡 進行中（2Rモック完成・3D化中） |
| 2. 実装 | B. 実装 | ⚪ 未着手 |
| 3. 検証 | C. 品質・運用 | ⚪ 未着手 |
| 4. 運用準備・リハ | C. 品質・運用 | ⚪ 未着手 |

## 0. 要件定義（統括）
- [x] 企画書の読み込み・ルール整理
- [x] 運用環境・入力方式・デザイン軸の決定
- [x] requirements.md 作成
- [x] GitHub リポジトリ作成（Nienu1976/numazu-quiz-scoreboard, Public）・初回push
- [ ] 未決事項の解消（requirements.md §4）
- [ ] 技術スタック決定
- [~] 主催者への確認依頼（organizer_questions.pdf 作成済み・回答待ち）

## 1. 設計
- [x] ルール仕様書（ラウンド別の状態・操作・判定・勝抜/失格条件） — rules-architect（rules_spec.md）
- [x] サドンデス・判定基準の共通仕様 — rules-architect（rules_spec.md §3-4）
- [x] ExR phase1 ボーダー同点除外の仕様＋例 — rules-architect（rules_spec.md §8.1）
- [x] 2R表示モック v2（S2札・回転灯・自席勝ち抜け） — harbor-designer
- [x] 2R表示の3D化 試作（mock/2r_mock_3d.html, e75b3aa） — 外部: Antigravity
- [x] 2R 3D 修正1回目（明るさ・上段ランプ・レイアウト拡大・リーチ演出, 6db34f0） — 外部: Antigravity
- [x] 2R 3D 修正2回目（失格フォント統一・沈む演出の明確化・下段ランプ・飛び残り自動勝ち抜け） — display-dev（ユーザー確認済み 2026-11-27）
- [ ] デザインシステム（色・書体・札コンポーネント） — harbor-designer
- [ ] 表示画面ワイヤー（ラウンド別） — harbor-designer
- [ ] 操作画面ワイヤー（名前/○/×の3行レイアウト） — harbor-designer
- [ ] データモデル・画面間通信設計 — rules-architect

## 2. 実装
- [~] プロジェクト雛形（Vite+TS済み・control.html/display.html）・GitHub Pages デプロイは未 — control-dev
- [x] ルールエンジン: 1R 採点・順位・プレート — rules-engine-dev
- [x] ルールエンジン: 2R 連答つき5○2× — rules-engine-dev
- [x] ルールエンジン: 3R-A 7up-down — rules-engine-dev
- [x] ルールエンジン: 3R-B 7by7 — rules-engine-dev
- [x] ルールエンジン: 3R-C Initial7 — rules-engine-dev
- [x] ルールエンジン: ExR phase1 / phase2 — rules-engine-dev
- [x] ルールエンジン: SF タイムレース — rules-engine-dev
- [x] ルールエンジン: F 10○2休 — rules-engine-dev
- [x] ルールエンジン: サドンデス・Undo — rules-engine-dev
- [x] 操作画面: 参加者管理・CSV読込 — control-dev
- [x] 操作画面: ペーパー得点入力（1Rのみ。ExR1は未） — control-dev
- [~] 操作画面: 早押し入力（3行レイアウト）2R実装済み。3R以降は未 — control-dev
- [~] 操作画面: 組分け（2R蛇腹・席入替）済み。コース選択・SF組分けは未 — control-dev
- [x] 表示画面: 自動投影（Window Management API）— 操作画面「投影開始」。外部ディスプレイ検出→全画面。不可時は通常ウィンドウ＋手動移動案内（実機の複数ディスプレイは未確認） — display-dev
- [~] 表示画面: ラウンド別表示・演出 — 2R 3Dを display.html に移植済み（src/display/、受信状態の差分から演出、undoは演出なし）。1Rは確定後の順位・プレート色の簡易表示。3R以降は未対応 — display-dev
- [ ] PWA化（オフライン起動） — display-dev
- [ ] エントリーページ — entry-dev
- [ ] GAS（スプレッドシート連携・締切判定） — entry-dev

## 3. 検証
- [x] ルール仕様とエンジンの突き合わせレビュー — qa-reviewer（review_engine.md。重大2・中5・軽微3）
- [ ] E2E（Playwright）通しシナリオ 1R→F — qa-reviewer
- [ ] Windows＋デュアルモニター実機確認チェックリスト — qa-reviewer
- [ ] 初見ユーザーによる操作テスト — qa-reviewer

## 4. 運用準備
- [ ] 当日操作マニュアル（初見向け） — ops-writer
- [ ] GAS 設定手順書 — ops-writer
- [ ] トラブル対応表（投影されない・PC再起動時の復旧等） — ops-writer
- [ ] 本番機でのリハーサル — 統括

## 補足: 操作画面（control-dev, 2026-11-27）
- 構成: `control.html` → `src/control/`（store=状態とイベント保存、payload=表示画面への送信データ、csv、main=UI）。`display.html` は受信確認だけの空の受け口。
- 保存: localStorage `numazu-quiz-control-v1` に参加者＋イベント列。状態は毎回 `replay` で再計算。
- 送信: BroadcastChannel `numazu-quiz-display`（`src/shared/protocol.ts`）。本名・ふりがな・連絡先は型に無く送れない（テストあり）。1R順位は確定後のみ送る。
- 判断: 1R確定後は参加者追加・削除・欠席変更を不可／確定取消は組分け前のみ／開始済みの組は席入替不可／無効操作（勝抜者への○など）はイベントに記録しない。
- 未対応: 1R同点の手動並べ替えUI（エンジンは対応済み）、3R以降・ExR・SF・F、SDの対象者選択（エンジン規約どおり自動）、CSV書き出し。
