import type { Lesson } from './types';

export const lessons: Lesson[] = [
  {
    id: 1, short: 'Linux', title: 'Linux 基本操作', objective: '現在地とファイル、OS情報を確認する',
    description: 'まずは安全な読み取りコマンドを実行し、Linuxターミナルの基本に慣れましょう。',
    tasks: [
      { id: 'linux-pwd', command: 'pwd', label: '現在の場所を確認', expected: ['/home/cyberbox'], successMessage: 'ホームディレクトリを確認できました。', hint: '/home/cyberbox と表示されるか確認しましょう。' },
      { id: 'linux-ls', command: 'ls -la', label: 'ファイル一覧を確認', expected: ['README.txt'], successMessage: '隠しファイルを含む一覧を確認できました。', hint: 'README.txt が表示されるか確認しましょう。' },
      { id: 'linux-os', command: 'cat /etc/os-release', label: 'OS情報を確認', expected: ['Debian GNU/Linux'], successMessage: 'OSの種類を確認できました。', hint: 'PRETTY_NAME の行に注目してください。' },
    ],
    points: ['現在のディレクトリ', 'ファイル一覧', 'OS情報'],
  },
  {
    id: 2, short: 'Network', title: 'ネットワーク確認', objective: '隔離されたラボ内の通信経路を理解する',
    description: 'IPアドレス、ルーティング、名前解決を確認し、targetだけに到達できることを確かめます。',
    tasks: [
      { id: 'network-ip', command: 'ip addr', label: 'IPアドレスを確認', expected: ['inet ', 'eth0'], successMessage: 'ラボ内のIPアドレスを確認できました。', hint: 'eth0 の inet 行を探してください。' },
      { id: 'network-route', command: 'ip route', label: '通信経路を確認', expected: ['dev eth0'], successMessage: 'ラボ内の経路を確認できました。', hint: 'dev eth0 を含む経路を確認してください。' },
      { id: 'network-ping', command: 'ping -c 3 target', label: 'targetへの到達確認', expected: ['0% packet loss'], successMessage: 'targetへの疎通を確認できました。', hint: 'packet loss の値を確認してください。' },
    ],
    points: ['IPアドレス', 'ルーティング', '内部DNS'],
    caution: '調査対象はラボ内の target のみです。外部ホストには実行しないでください。',
  },
  {
    id: 3, short: 'nmap', title: 'nmap 基本', objective: 'targetで待ち受けるポートを発見する',
    description: '短時間のポートスキャンから、TCPポートの状態とサービスを読み取ります。',
    tasks: [
      { id: 'nmap-port', command: 'nmap -p 3000 target', label: '3000番ポートを確認', expected: ['3000/tcp', 'open'], successMessage: 'Webサービスのポートを発見できました。', hint: '3000/tcp の STATE が open か確認しましょう。' },
    ],
    points: ['TCP', 'port', 'open / closed', 'service'], caution: 'スキャン対象は target のみに固定してください。',
  },
  {
    id: 4, short: 'HTTP', title: 'HTTP 確認', objective: 'Webサーバーの応答をターミナルから観察する',
    description: 'curlでステータス、ヘッダー、HTML本文を取得します。',
    tasks: [
      { id: 'http-head', command: 'curl -I http://target:3000', label: 'HTTPヘッダーを確認', expected: ['HTTP/1.1 200'], successMessage: '正常なHTTP応答を確認できました。', hint: '先頭のHTTPステータス行を確認してください。' },
      { id: 'http-body', command: 'curl http://target:3000', label: 'HTML本文を確認', expected: ['<!doctype html'], successMessage: 'WebページのHTMLを取得できました。', hint: '<!doctype html から始まる出力を探してください。' },
    ],
    points: ['HTTP', 'Status Code', 'Header', 'HTML'],
  },
  {
    id: 5, short: 'Service', title: 'サービス確認', objective: 'サービスとバージョンの手掛かりを得る',
    description: 'nmapのサービス検出を使い、開いているポートの用途を詳しく確認します。',
    tasks: [
      { id: 'service-version', command: 'nmap -sV -p 3000 target', label: 'サービスを識別', expected: ['3000/tcp', 'open', 'http'], successMessage: '3000番ポートのサービスを識別できました。', hint: '3000/tcp のSERVICE列を確認してください。' },
    ],
    points: ['Service Detection', 'Version Detection', '結果の確かめ方'], caution: '検出結果には推測も含まれます。curlの結果と組み合わせて判断しましょう。',
  },
];

export const allTasks = lessons.flatMap((lesson) => lesson.tasks);
