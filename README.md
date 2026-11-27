# numazu-quiz-scoreboard

沼東OB例会 クイズ大会の得点表示システム（操作画面・プロジェクター表示画面・エントリーページ）。

- 要件定義: [docs/numazu_ob_quiz_scoreboard/requirements.md](docs/numazu_ob_quiz_scoreboard/requirements.md)
- 役割分担: [docs/numazu_ob_quiz_scoreboard/roles.md](docs/numazu_ob_quiz_scoreboard/roles.md)
- 進捗: [docs/numazu_ob_quiz_scoreboard/task.md](docs/numazu_ob_quiz_scoreboard/task.md)

## 公開ページ（GitHub Pages）
ベースURL: https://nienu1976.github.io/numazu-quiz-scoreboard/
- 2R 3D版（Antigravity作）: [mock/2r_mock_3d.html](https://nienu1976.github.io/numazu-quiz-scoreboard/docs/numazu_ob_quiz_scoreboard/mock/2r_mock_3d.html)
- 2R 2D版: [mock/2r_mock.html](https://nienu1976.github.io/numazu-quiz-scoreboard/docs/numazu_ob_quiz_scoreboard/mock/2r_mock.html)
- 全ラウンド2D: [mock/all_rounds_mock.html](https://nienu1976.github.io/numazu-quiz-scoreboard/docs/numazu_ob_quiz_scoreboard/mock/all_rounds_mock.html)
- 1R ターンオーバー: [mock/r1_turnover_mock.html](https://nienu1976.github.io/numazu-quiz-scoreboard/docs/numazu_ob_quiz_scoreboard/mock/r1_turnover_mock.html)

※ `github.com/.../blob/...` のリンクはコード表示なので、画面を見るときは上の Pages のURLを使う。

## 本番画面（試用版）
- 操作画面: https://nienu1976.github.io/numazu-quiz-scoreboard/app/control.html
- 表示画面: https://nienu1976.github.io/numazu-quiz-scoreboard/app/display.html
- `app/` は `npx vite build --outDir app --emptyOutDir` の出力。ソース変更後は再ビルドしてコミットする
