import type { Lesson } from './types';
export const lessons:Lesson[]=[
{id:1,short:'Linux',title:'Linux 基本操作',objective:'Linux の現在地とファイルを確認する',description:'pwd、ls、cd、cat は端末操作の土台です。まず安全な読み取り操作から始めます。',commands:['pwd','ls -la','cat /etc/os-release'],points:['現在のディレクトリ','隠しファイルを含む一覧','OS情報の読み方']},
{id:2,short:'Network',title:'ネットワーク確認',objective:'隔離されたラボ内の通信経路を理解する',description:'IPアドレス、ルーティング、名前解決を確認し、target だけに到達できることを確かめます。',commands:['ip addr','ip route','ping -c 3 target'],points:['IPアドレス','デフォルトルート','内部DNS'],caution:'外部ホストへの調査は禁止です。ラボ内の target のみを使用してください。'},
{id:3,short:'nmap',title:'nmap 基本',objective:'ターゲットで待ち受けるサービスを発見する',description:'ポートスキャンの結果から TCP ポートの状態とサービス候補を読み取ります。',commands:['nmap target'],points:['TCP','port','open / closed','service'],caution:'スキャン対象は target のみに固定してください。'},
{id:4,short:'HTTP',title:'HTTP 確認',objective:'Webサーバーの応答を端末から観察する',description:'curl でHTTPステータス、ヘッダー、HTML本文を取得します。',commands:['curl -I http://target:3000','curl http://target:3000'],points:['HTTP','Status Code','Header','HTML']},
{id:5,short:'Service',title:'サービス確認',objective:'サービスとバージョンの手掛かりを得る',description:'nmap のサービス検出を使い、開いているポートの用途を詳しく確認します。',commands:['nmap -sV target'],points:['Service Detection','Version Detection','追加確認の組み立て方'],caution:'検出結果は推測を含みます。curl等で追加確認してください。'}];
