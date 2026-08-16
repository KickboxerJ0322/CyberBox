export const lessons = [
  { id: 1, title: 'Kali Linux 基本操作', description: 'Kali Linuxの利用者、ファイル、OS情報を確認します。' },
  { id: 2, title: 'ネットワーク確認', description: '隔離ラボ内のIP、経路、targetへの到達性を確認します。' },
  { id: 3, title: 'サービス偵察', description: 'nmapでJuice Shopのポートとサービスを調査します。' },
  { id: 4, title: 'HTTPとAPI調査', description: 'curlでJuice ShopのHTTPレスポンスと公開APIを調査します。' },
  { id: 5, title: 'Webコンテンツ探索', description: 'KaliのWeb診断ツールで公開パスを探索します。' },
  { id: 6, title: 'SQLインジェクション', description: 'Juice Shopの隔離ログインAPIで認証回避を体験します。' },
  { id: 7, title: '機密情報の露出', description: '公開されてしまったファイルを発見し、影響を確認します。' },
] as const;
