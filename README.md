# CyberBox

**Browser-Based Cybersecurity Laboratory**

CyberBoxは、ローカルへKali LinuxやVirtualBoxを入れずに、ブラウザだけでLinux・ネットワーク・Webセキュリティを学べる個人学習用ラボです。演習対象はラボ内で起動したOWASP Juice Shopだけに限定されます。

## MVPでできること

- xterm.jsによるブラウザLinuxターミナル
- `pwd`、`ip addr`、`nmap target`、`curl http://target:3000` 等の実行
- OWASP Juice Shopの安全なリバースプロキシ表示
- Linux、Network、nmap、HTTP、Serviceの5レッスン
- Geminiによる実行結果の日本語解説
- ラボごとの隔離ネットワーク、リソース制限、60分タイムアウト
- Stop Labによるコンテナ・ネットワークの削除

## 必要なソフト

- Node.js 22以降
- Docker Engine / Docker Desktop（Compose v2）
- Gemini APIキー（AI解説を利用する場合のみ）

## セットアップ

```bash
git clone https://github.com/KickboxerJ0322/CyberBox.git
cd CyberBox
cp .env.example .env
```

`.env` の `GEMINI_API_KEY` を設定します。モデルは `GEMINI_MODEL` で変更できます。APIキーを設定しなくても、ターミナルとラボは利用できます。

## Dockerで起動

```bash
docker compose --profile images build
docker compose pull target-image docker-proxy
docker compose up -d --build
```

ブラウザで <http://localhost:8080> を開きます。ログは `docker compose logs -f`、停止は次のコマンドです。

```bash
docker compose down
```

停止時に残った演習コンテナはラベル `cyberbox.managed=true` で識別できます。通常はバックエンドの終了処理が自動削除します。

## DockerなしでUIを確認

```bash
npm install
$env:DEMO_MODE="true"  # Windows PowerShell
npm run dev
```

macOS/Linuxでは `DEMO_MODE=true npm run dev` を使用します。<http://localhost:5173> で、模擬ターミナルと画面を確認できます。

## 開発とテスト

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

## Google Cloudへの配置

動的Dockerラボが必要なため、デプロイ先はCompute Engineを想定しています。通常のGitHubトリガーは `cloudbuild.yaml` で型検査、テスト、アプリ・Dockerビルドまで行います。課金対象VMを用意した後、`deploy/bootstrap-gce.sh` をUbuntu VMのstartup scriptとして使用し、デプロイトリガーには `cloudbuild.deploy.yaml` を指定します。既定値はプロジェクト `jumpeicloud`、ゾーン `asia-northeast1-b`、VM名 `cyberbox` です。

Cloud Buildサービスアカウントには対象VMへのIAP SSHとOS Loginに必要な最小権限を与えてください。Geminiキーはリポジトリへ保存せず、VMのSecret Managerアクセスまたは安全な `.env` 配置で管理します。詳しくは [docs/architecture.md](docs/architecture.md) を参照してください。

## トラブルシューティング

- **Labを起動できない:** Docker Desktopが起動中か、attacker/targetイメージが存在するか確認します。
- **Target is not ready:** Juice Shopの初回起動に数十秒かかる場合があります。少し待って再読み込みします。
- **Gemini unavailable:** APIキー、モデル名、割当量を確認します。ラボ機能は停止しません。
- **外部へ通信できない:** セキュリティ設計どおりです。演習対象は `target` のみです。

> 許可のないシステムへのスキャンや攻撃には使用しないでください。
