import type { Lesson } from './types';

export const lessons: Lesson[] = [
  {
    id: 1, short: 'Kali', title: 'Kali Linux 基本操作', objective: '攻撃側コンテナがKali Linuxであることを確認する',
    description: '安全な読み取りコマンドを実行し、ターミナルとKali環境の基本を確認します。',
    tasks: [
      { id: 'kali-whoami', command: 'whoami', label: '実行ユーザーを確認', expected: ['cyberbox'], successMessage: '一般ユーザーで動作していることを確認できました。', hint: '出力に cyberbox が含まれるか確認してください。' },
      { id: 'kali-ls', command: 'ls -la', label: 'ホームのファイルを確認', expected: ['README.txt'], successMessage: 'Kaliコンテナの案内ファイルを確認できました。', hint: 'README.txt が表示されるか確認してください。' },
      { id: 'kali-os', command: 'cat /etc/os-release', label: 'Kali OS情報を確認', expected: ['Kali GNU/Linux'], successMessage: '攻撃側がKali Linuxであることを確認できました。', hint: 'PRETTY_NAMEまたはNAMEにKaliがあるか確認してください。' },
    ], points: ['Kali Linux', '一般ユーザー', '隔離コンテナ'],
  },
  {
    id: 2, short: 'Network', title: 'ネットワーク確認', objective: '隔離されたラボ内でtargetだけに到達する',
    description: 'IPアドレス、経路、名前解決を確認し、攻撃対象targetへの接続を確かめます。',
    tasks: [
      { id: 'network-ip', command: 'ip addr', label: 'IPアドレスを確認', expected: ['inet ', 'eth0'], successMessage: 'ラボ内IPを確認できました。', hint: 'eth0のinet行を探してください。' },
      { id: 'network-route', command: 'ip route', label: '通信経路を確認', expected: ['dev eth0'], successMessage: 'ラボ内の経路を確認できました。', hint: 'dev eth0を含む行を探してください。' },
      { id: 'network-ping', command: 'ping -c 3 target', label: 'targetへの到達を確認', expected: ['0% packet loss'], successMessage: 'targetへの到達を確認できました。', hint: 'packet lossの値を確認してください。' },
    ], points: ['IPアドレス', 'ルーティング', '内部DNS'], caution: '対象はラボ内のtargetだけです。外部ホストには実行しないでください。',
  },
  {
    id: 3, short: 'Recon', title: 'サービス偵察', objective: 'Juice Shopが待ち受けるポートをKaliから発見する',
    description: 'nmapのバージョン検出で、target上のWebサービスを調べます。',
    tasks: [{ id: 'recon-nmap', command: 'nmap -sV -p 3000 target', label: '3000番ポートを調査', expected: ['3000/tcp', 'open', 'http'], successMessage: 'Juice ShopのWebポートを発見できました。', hint: '3000/tcpのSTATEとSERVICEを確認してください。' }],
    points: ['nmap', 'TCP port', 'service detection'], caution: 'スキャン対象はtargetに固定されています。',
  },
  {
    id: 4, short: 'HTTP/API', title: 'HTTPとAPI調査', objective: 'Webアプリの応答と公開APIを観察する',
    description: 'curlを使い、ブラウザ画面の裏でどのようなHTTP応答が返るか確認します。',
    tasks: [
      { id: 'http-head', command: 'curl -I http://target:3000', label: 'HTTPヘッダーを確認', expected: ['HTTP/1.1 200'], successMessage: '正常なHTTP応答を確認できました。', hint: '先頭のHTTPステータス行を確認してください。' },
      { id: 'http-config', command: 'curl -s http://target:3000/rest/admin/application-configuration', label: '公開設定APIを確認', expected: ['application', 'config'], successMessage: 'Juice Shopの設定APIを取得できました。', hint: 'JSON内のapplicationやconfigを探してください。' },
    ], points: ['HTTP', 'Status Code', 'REST API', 'JSON'],
  },
  {
    id: 5, short: 'Discovery', title: '公開ファイル探索', objective: 'Webサーバーに露出したディレクトリを発見する',
    description: 'Kaliに入っているdirbの小さな辞書を使い、Juice Shopの公開パスを調べます。',
    tasks: [{ id: 'discover-ftp', command: 'curl -s http://target:3000/ftp/', label: '公開FTP一覧を確認', expected: ['acquisitions.md'], successMessage: '公開されている機密ファイル名を発見しました。', hint: '一覧からacquisitions.mdを探してください。' }],
    points: ['Content Discovery', '情報露出', '攻撃面'], caution: '実環境では、公開ファイルの取得にも明示的な許可が必要です。',
  },
  {
    id: 6, short: 'SQLi', title: 'SQLインジェクション', objective: '入力値がSQLとして解釈される危険を体験する',
    description: '隔離されたJuice ShopのログインAPIに検証用ペイロードを送り、認証回避が起きることを確認します。',
    tasks: [{ id: 'sqli-login', command: `curl -s -X POST http://target:3000/rest/user/login -H "Content-Type: application/json" --data "{\\"email\\":\\"admin' OR 1=1--\\",\\"password\\":\\"x\\"}"`, label: 'ログイン認証回避を検証', expected: ['authentication', 'token'], successMessage: 'SQLインジェクションによる認証回避を確認しました。', hint: 'JSONレスポンスにauthenticationとtokenが含まれるか確認してください。' }],
    points: ['SQL Injection', '認証回避', '入力のパラメータ化'], caution: 'このペイロードはCyberRoom内のJuice Shopだけで使用してください。',
  },
  {
    id: 7, short: 'Exposure', title: '機密情報の露出', objective: '公開された文書を読み、情報漏えいの影響を理解する',
    description: '前のレッスンで発見した文書を取得し、公開すべきでない情報を確認します。',
    tasks: [{ id: 'exposure-file', command: 'curl -s http://target:3000/ftp/acquisitions.md', label: '露出した文書を確認', expected: ['acquisition'], successMessage: '公開ディレクトリから文書を取得できることを確認しました。', hint: '文書内のacquisitionという語を確認してください。' }],
    points: ['Sensitive Data Exposure', '公開範囲', 'アクセス制御'], caution: '取得対象は演習用Juice Shop内のファイルだけです。',
  },
];

export const allTasks = lessons.flatMap((lesson) => lesson.tasks);
