# CyberBox アーキテクチャ

## 全体構成

```text
Browser
  ├─ HTTPS / REST ──> Nginx frontend ──> Express API
  ├─ WebSocket ────────────────────────> Terminal bridge
  └─ /lab/{sessionId}/target/ ─────────> Target reverse proxy
                                             │
Express ──> restricted Docker socket proxy ──┤
  │                                          ▼
  └─ Gemini API                    per-session internal network
                                       ├─ attacker (Debian)
                                       └─ target (Juice Shop)
```

`Start Lab` ごとにUUID、内部Dockerネットワーク、attacker、targetを生成します。内部ネットワークは `Internal: true` で、attackerには外部へのデフォルト経路がありません。ブラウザはtargetへ直接接続せず、セッション検証を行うバックエンド経由でだけ表示します。

## コンテナ制御

バックエンドへ `/var/run/docker.sock` を直接マウントしません。Docker APIのうち、コンテナ、ネットワーク、イメージ、execに必要な操作のみを公開するソケットプロキシを使います。利用者はイメージ名、ネットワーク、Dockerオプションを指定できません。

attackerの標準値は1 CPU、512 MiB、100プロセス、全capability削除後 `NET_RAW` のみ追加、`no-new-privileges` です。targetも1 CPU、512 MiB、100プロセス、全capabilityを削除します。

## セッション

- UUID v4をセッションIDとして使用
- 初期有効時間60分（環境変数で5〜120分）
- Stop Lab、タイムアウト、プロセス終了時にコンテナとネットワークを削除
- WebSocket接続時とtarget proxy利用時にセッションIDを検証
- 同時ラボ数を制限

MVPではセッション情報をメモリに保持します。複数バックエンドへ水平分割する場合はRedis等へ移し、所有インスタンスを記録してください。

## Gemini

ターミナル出力、実行コマンド、現在のレッスンだけをバックエンドからGeminiへ送ります。JSON応答をZodで検証し、失敗、タイムアウト、APIキー未設定時は安全な固定文へフォールバックします。APIキーとプロンプト全文はログに保存しません。

## Google Cloud

兄弟Dockerコンテナを動的に生成するため、Cloud RunではなくCompute Engineを採用します。`cloudbuild.yaml` は `main` 更新時のCIを担当します。課金対象VMの作成後は、別トリガーで `cloudbuild.deploy.yaml` を実行するとIAP経由でVMへ接続し、最新コミットを取得してDocker Composeを再構築できます。VMは外部公開ポートをロードバランサーまたはファイアウォールで8080のみに制限してください。

## セキュリティ上の境界

- 練習対象はセッション内の `target` のみ
- attackerとtargetはホストへポート公開しない
- API rate limit、JSONサイズ制限、CSP、Helmetを適用
- コマンドログ中のpassword、token、API key、cookieらしき値を秘匿
- `.env` とAPIキーをGitへ含めない

本番ではTLS、認証、Secret Manager、Cloud Armor、監査ログ、定期的なベースイメージ更新を追加してください。
