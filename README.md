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
- **演習サイトを起動しています:** Juice Shopの初回起動には通常10〜30秒かかります。画面が準備完了を自動確認するため、手動の再読み込みは不要です。
- **Gemini unavailable:** APIキー、モデル名、割当量を確認します。ラボ機能は停止しません。
- **外部へ通信できない:** セキュリティ設計どおりです。演習対象は `target` のみです。

> 許可のないシステムへのスキャンや攻撃には使用しないでください。

## Compute Engine VMでGeminiを有効にする

Gemini APIキーはブラウザ側やGitHubへ置かず、VM上のバックエンド環境変数として設定します。

1. [Google AI Studio](https://aistudio.google.com/apikey)でAPIキーを作成します。
2. Compute EngineのSSH画面で次を実行します。

```bash
cd /opt/cyberbox
sudo nano .env
```

3. `.env` に次の2行を設定して保存します。

```dotenv
GEMINI_API_KEY=ここに作成したAPIキー
GEMINI_MODEL=gemini-3.6-flash
```

4. 環境変数を読み直すため、バックエンドコンテナを再作成します。

```bash
cd /opt/cyberbox
sudo docker compose up -d --force-recreate backend
```

CyberBoxを開き直し、右下の「GEMINI AI」が `READY` になれば完了です。`.env` は `.gitignore` の対象です。APIキーをチャット、画面共有、ソースコード、GitHubへ貼り付けないでください。本格運用ではGoogle Cloud Secret Managerの利用を推奨します。
