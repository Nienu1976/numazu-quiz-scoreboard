# Cloudflare セットアップ手順（大会公開サイト）

対象: `site/`（大会案内・エントリー・参加者リスト・管理）。作業はすべて**ご自身のブラウザ**で行います。コマンド操作は不要です（GitHub 連携でデプロイされます）。
所要時間の目安: 30〜45分。ポータルサイトと同じ Cloudflare アカウントを使います。

用語: **Pages**=サイトの置き場、**D1**=名簿を入れるデータベース、**Access**=管理ページの鍵（ログイン制限）、**Turnstile**=ボット対策。

---

## 0. 事前に知っておくこと
- 本名・ふりがな・連絡先は D1 に保存され、**管理ページ（Access でログインした運営）だけ**が見られます。公開API・公開ページは表示名と卒業期のみ返します（テストで保証）。
- 会場・参加費・受付期間などは `site/site.config.json` の1か所で変更します。GitHub 上で編集して保存（コミット）すると自動で反映されます。`null` は「調整中」と表示されます。
- 受付期間は日本時間で `"2027-02-01T00:00:00+09:00"` の形式で書きます。`null` なら無期限（＝いつでも受付）です。**公開前に必ず期間を決めて入れてください**。

## 1. Cloudflare アカウント
1. https://dash.cloudflare.com にログイン（ポータルサイトで使っているアカウント）。

## 2. D1 データベースを作る
1. 左メニュー **Storage & Databases → D1 SQL Database → Create**。
2. 名前は **`numazu-entry`**。作成する。
3. 作成後の画面に出る **Database ID**（英数字とハイフンの長い文字列）をコピー。
4. GitHub の `site/wrangler.toml` を開き、`database_id = "0000…"` をコピーした ID に書き換えて保存（コミット）。※ID は秘密情報ではありません。
5. D1 の **Console** タブを開き、リポジトリの `site/migrations/0001_init.sql` の中身を**全部貼り付けて実行**（Execute）。`entries` テーブルができれば成功。

## 3. Pages プロジェクトを作って GitHub と連携
1. **Workers & Pages → Create → Pages → Connect to Git**。GitHub を連携し、リポジトリ `numazu-quiz-scoreboard` を選択。
2. ビルド設定:
   - Project name: 例 `numazu-quiz`（URL が `https://numazu-quiz.pages.dev` になります）
   - Production branch: `main`
   - **Root directory（詳細設定）: `site`**
   - Build command: 空欄
   - Build output directory: `public`
3. **Save and Deploy**。数分で公開されます。
4. 開いて確認: `/`（案内）、`/entry.html`、`/entries.html`。
5. 独自ドメインにする場合は Pages プロジェクトの **Custom domains** から追加（任意）。

> `wrangler.toml` がある Pages では、D1 のバインド（変数名 `DB`）はこのファイルの内容が使われます。ダッシュボード側で追加設定は不要です。

## 4. 管理ページを Access で守る（重要）
**これをやるまで `/admin` と `/api/admin/*` を公開しないでください**（アプリ側でも Access 経由でないと拒否しますが、二重の保護です）。

1. 左メニュー **Zero Trust**（初回は組織名を決め、無料プランを選択）。
2. **Access → Applications → Add an application → Self-hosted**。
3. Application name: `沼東クイズ管理`。**Application domain を2つ**追加:
   - `numazu-quiz.pages.dev` / Path `admin`
   - `numazu-quiz.pages.dev` / Path `api/admin`
   （独自ドメインを使うならそのドメインでも同様に）
4. Policy: Action=**Allow**、Include=**Emails**、運営メンバーのメールアドレスを列挙。
5. 保存後、アプリケーションの **Overview** にある **Application Audience (AUD) Tag** をコピー。Zero Trust の **Settings → Custom Pages**付近または URL に出る **Team domain**（`xxxx.cloudflareaccess.com`）も控える。
6. Pages プロジェクト **Settings → Variables and Secrets** に追加（Production）:
   - `CF_ACCESS_TEAM_DOMAIN` = `xxxx.cloudflareaccess.com`
   - `CF_ACCESS_AUD` = コピーした AUD Tag
   これでアプリ側が Access の署名付きトークンを検証します（未設定でもヘッダ必須チェックは動きますが、設定を推奨）。
7. 確認: シークレットウィンドウで `/admin/` を開く → メール認証の画面が出れば OK。ログイン後に一覧が出る。

## 5. Turnstile（ボット対策）
1. 左メニュー **Turnstile → Add widget**。Widget name: `numazu-entry`、Hostname に公開ドメイン（`numazu-quiz.pages.dev` 等）、Mode: Managed。
2. 表示される **Site Key** と **Secret Key** をコピー。
3. Pages の **Variables and Secrets** に追加（Production）:
   - `TURNSTILE_SITE_KEY` = Site Key
   - `TURNSTILE_SECRET` = Secret Key（**Secret（暗号化）**として追加）
4. 再デプロイ（Deployments → 最新の ⋯ → Retry deployment）。エントリー画面にチェックが出れば完了。未設定のままだと Turnstile は無効（honeypot のみ）で動きます。

## 6. 受付開始前の動作確認チェックリスト
- [ ] テスト用に1件エントリー → 受付番号が出る → `/entries.html` に表示名・卒業期だけ出る
- [ ] `/admin/` で本名・ふりがな・連絡先が見える。修正・取消ができる
- [ ] 同じ氏名＋卒業期で再送信すると「エントリー済み」と出る
- [ ] CSV書き出し → 操作画面の「参加者CSV読込」で読み込める
- [ ] テスト用エントリーを管理ページで取消（運営向けに、取消はデータを残します。完全に消したい場合は D1 Console で `DELETE FROM entries WHERE id=…`）
- [ ] 受付期間・会場などを `site.config.json` に入れた

## 7. ローカルで試す（開発者向け）
```
cd site && npm install
cp .dev.vars.example .dev.vars        # ローカルのみ Access 検査を省略
npm run db:migrate:local
npm run dev                            # http://localhost:8788
npm test
```

## 8. 運用メモ
- 荒らし対策の追加: Cloudflare の **Security → WAF → Rate limiting rules** で `/api/entries`（POST）を「1分あたり10回/IP」などに制限できます（任意）。
- キャンセル待ち: 確定者を管理ページで取消すと、先頭のキャンセル待ちが自動で確定に繰り上がります（`autoPromote`）。繰り上がった方への連絡は運営が手動で行います。
- 定員超過を受け付けず締め切りたい場合は `site.config.json` の `"overflow": "close"`。
- バックアップ: 開催前に管理ページから CSV を書き出して保管。
