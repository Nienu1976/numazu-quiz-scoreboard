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
- [ ] ルール仕様書（ラウンド別の状態・操作・判定・勝抜/失格条件） — rules-architect
- [ ] サドンデス・判定基準の共通仕様 — rules-architect
- [ ] ExR phase1 ボーダー同点除外の仕様＋例 — rules-architect
- [x] 2R表示モック v2（S2札・回転灯・自席勝ち抜け） — harbor-designer
- [x] 2R表示の3D化 試作（mock/2r_mock_3d.html, e75b3aa） — 外部: Antigravity
- [ ] デザインシステム（色・書体・札コンポーネント） — harbor-designer
- [ ] 表示画面ワイヤー（ラウンド別） — harbor-designer
- [ ] 操作画面ワイヤー（名前/○/×の3行レイアウト） — harbor-designer
- [ ] データモデル・画面間通信設計 — rules-architect

## 2. 実装
- [ ] プロジェクト雛形・GitHub Pages デプロイ — control-dev
- [ ] ルールエンジン: 1R 採点・順位・プレート — rules-engine-dev
- [ ] ルールエンジン: 2R 連答つき5○2× — rules-engine-dev
- [ ] ルールエンジン: 3R-A 7up-down — rules-engine-dev
- [ ] ルールエンジン: 3R-B 7by7 — rules-engine-dev
- [ ] ルールエンジン: 3R-C Initial7 — rules-engine-dev
- [ ] ルールエンジン: ExR phase1 / phase2 — rules-engine-dev
- [ ] ルールエンジン: SF タイムレース — rules-engine-dev
- [ ] ルールエンジン: F 10○2休 — rules-engine-dev
- [ ] ルールエンジン: サドンデス・Undo — rules-engine-dev
- [ ] 操作画面: 参加者管理・CSV読込 — control-dev
- [ ] 操作画面: ペーパー得点入力 — control-dev
- [ ] 操作画面: 早押し入力（3行レイアウト） — control-dev
- [ ] 操作画面: 組分け・コース選択・席順 — control-dev
- [ ] 表示画面: 自動投影（Window Management API） — display-dev
- [ ] 表示画面: ラウンド別表示・演出 — display-dev
- [ ] PWA化（オフライン起動） — display-dev
- [ ] エントリーページ — entry-dev
- [ ] GAS（スプレッドシート連携・締切判定） — entry-dev

## 3. 検証
- [ ] ルール仕様とエンジンの突き合わせレビュー — qa-reviewer
- [ ] E2E（Playwright）通しシナリオ 1R→F — qa-reviewer
- [ ] Windows＋デュアルモニター実機確認チェックリスト — qa-reviewer
- [ ] 初見ユーザーによる操作テスト — qa-reviewer

## 4. 運用準備
- [ ] 当日操作マニュアル（初見向け） — ops-writer
- [ ] GAS 設定手順書 — ops-writer
- [ ] トラブル対応表（投影されない・PC再起動時の復旧等） — ops-writer
- [ ] 本番機でのリハーサル — 統括
