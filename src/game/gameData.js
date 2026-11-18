// イベントと目標の定義（データのみ）

export const EVENTS = [
  { id: 'feeding', name: '餌やりショー', text: '飼育員の解説つきで餌やりを公開します', cost: 20000, minutes: 10, mult: 1.3, need: (s) => (s.creatures < 3 ? '展示中の生き物が3匹必要です' : '') },
  { id: 'kids', name: '親子ふれあい体験', text: '子ども向けの体験教室を開きます', cost: 50000, minutes: 20, mult: 1.4, need: (s) => (s.guides < 2 ? '案内スタッフが2人必要です' : '') },
  { id: 'night', name: '夜の水族館', text: '照明を落とした幻想的な夜間営業です', cost: 100000, minutes: 30, mult: 1.6, need: (s) => (s.tanks < 3 ? '水槽が3基必要です' : '') },
  { id: 'special', name: '特別展', text: '集めた生き物を一堂に紹介する大型企画です', cost: 500000, minutes: 60, mult: 2, need: (s) => (s.species < 15 ? '図鑑に15種の発見が必要です' : '') },
];

/** 順番に達成していく目標。done(s) が true になると報酬を受け取れる */
export const GOALS = [
  { id: 'tank2', text: '水槽を2基にする（アイテム→取引先）', reward: 10000, done: (s) => s.tanks >= 2 },
  { id: 'catch', text: '地図から採取遠征に出かけて、生き物を受け取る', reward: 5000, done: (s) => s.species >= 1 },
  { id: 'show', text: '生き物を水槽に展示する（アイテム→生物）', reward: 8000, done: (s) => s.creatures >= 1 },
  { id: 'feed', text: '飼育画面で生き物にエサをあげる', reward: 5000, done: (s) => s.flags.fed },
  { id: 'home', text: '地図で水族館の立地を設定する', reward: 5000, done: (s) => s.hasHome },
  { id: 'shop', text: 'レイアウトでお土産店を設置する', reward: 20000, done: (s) => s.shops >= 1 },
  { id: 'event', text: 'イベントを開催する（その他→イベント）', reward: 30000, done: (s) => s.flags.event },
  { id: 'zukan10', text: '図鑑で10種を発見する', reward: 100000, done: (s) => s.species >= 10 },
];

/** 閉じている間の収入の上限と、営業中に対する割合 */
export const OFFLINE_MAX_HOURS = 8;
export const OFFLINE_RATE = 0.5;
