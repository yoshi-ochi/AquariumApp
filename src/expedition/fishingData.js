/**
 * 漁法の教材データ。how: 仕組み、note: 資源管理や環境の視点、steps: 再現する作業の流れ。
 * cost / time はその漁法を使うときの遠征費用・時間の倍率。
 */
const step = (title, text, sec = 4) => ({ title, text, sec });

export const METHODS = [
  {
    id: 'purse', name: 'まき網', cost: 1.5, time: 0.8,
    how: '魚の群れを大きな網でぐるりと囲み、網の下を締めて逃げ道をふさぎます。イワシ・アジ・サバなど群れをつくる魚に向いた、日本で漁獲量が最も多い漁法です。',
    note: '一度に大量にとれるため、漁獲量の上限（TAC）を守る管理が特に大切です。',
    steps: [step('魚群を探す', '魚群探知機とソナーで、群れの位置と大きさを確かめます。'), step('網を投入する', '船が群れの周りを円を描いて走り、網のカーテンを下ろします。', 5), step('環を締める', '網の下の環に通した綱を引き、巾着のように底を閉じます。'), step('網を絞る', '網を船に寄せて囲みを小さくし、魚を集めます。')],
  },
  {
    id: 'trawl', name: '底びき網', cost: 1.3, time: 1,
    how: '袋状の網を船で引き、海底近くの魚やエビ、カニをとります。開口板が水の抵抗で左右に開き、網の口を広げます。',
    note: '海底の環境に影響しやすいため、網目の大きさや操業する海域・期間の制限が設けられています。',
    steps: [step('網を下ろす', '船の後ろから網と開口板を海底まで下ろします。', 5), step('海底を引く', '開口板が網の口を広げ、海底近くの生き物を袋網へ導きます。', 5), step('網を巻き上げる', 'ウインチで引き綱を巻き、袋網を船に揚げます。')],
  },
  {
    id: 'setnet', name: '定置網', cost: 0.8, time: 1.4,
    how: '魚の通り道に網を固定して待ちます。垣網にぶつかった魚は沿って進み、箱網へ入ります。沿岸の回遊魚が中心で、思わぬ大物も入ります。',
    note: '入った魚の一部は網から逃げられるため、資源にやさしい「待ちの漁業」といわれます。',
    steps: [step('垣網を張る', '岸から沖へ、魚の進路をさえぎる垣網を張ります。', 5), step('箱網を沈める', '垣網の先に、魚をためる箱網を固定します。'), step('魚を待つ', '魚は垣網に沿って泳ぎ、箱網へ入っていきます。', 5)],
  },
  {
    id: 'pole', name: '一本釣り', cost: 0.9, time: 1,
    how: '群れに生きたイワシをまき、水しぶきで興奮させて1匹ずつ釣り上げます。カツオ漁が代表的です。',
    note: '狙った魚だけを釣るため混獲が少なく、魚体も傷みにくい漁法です。',
    steps: [step('群れに近づく', '鳥の群れや魚群探知機を手がかりに、群れへ向かいます。'), step('餌と水をまく', '生き餌をまき、散水で小魚の群れのように見せます。'), step('釣り上げる', '竿を一気に振り上げ、魚を船上へ次々と揚げます。', 5)],
  },
  {
    id: 'longline', name: 'はえ縄', cost: 1.2, time: 1.5,
    how: '長い幹縄に、釣り針のついた枝縄を何本も等間隔につけて海に流します。マグロなど広い範囲を泳ぐ魚や、海底の魚を狙います。',
    note: 'ウミガメや海鳥の混獲を減らすため、針の形や投入方法の工夫が進んでいます。',
    steps: [step('幹縄を延ばす', '船を走らせながら、浮きをつけた幹縄を海へ延ばします。', 5), step('枝縄の針を沈める', '餌をつけた枝縄が狙いの深さまで沈みます。'), step('魚がかかるのを待つ', '時間をおいて、餌に食いつく魚を待ちます。')],
  },
  {
    id: 'gill', name: '刺し網', cost: 0.8, time: 1.2,
    how: '帯のような網を海中に張り、泳いできた魚を網目に刺したり絡ませたりしてとります。沿岸の小規模な漁業で広く使われます。',
    note: '網目の大きさで獲る魚の大きさを選べます。失われた網が魚をとり続ける「ゴーストフィッシング」の防止が課題です。',
    steps: [step('網を張る', '浮きと重りのついた網を、壁のように海中へ張ります。', 5), step('魚を待つ', '網に気づかず泳いできた魚が、網目にかかります。', 5)],
  },
  {
    id: 'pots', name: 'かご漁', cost: 0.7, time: 1.3,
    how: '餌を入れたかごを海底に沈め、中に入った生き物をとります。カニ、エビ、タコ、岩場の魚などが対象です。',
    note: '生きたまま揚がるので、小さな個体を海へ戻しやすい漁法です。',
    steps: [step('かごに餌を入れる', '魚やイカの餌をかごの中に取り付けます。'), step('かごを沈める', '目印の浮きをつけて、海底へ順番に沈めます。', 6), step('生き物を待つ', '餌のにおいに誘われて、かごの中へ入ってきます。')],
  },
  {
    id: 'bouke', name: '棒受け網', cost: 1.1, time: 1,
    how: '夜の海で集魚灯をつけ、光に集まる習性を利用します。サンマ漁の代表的な漁法で、船の片側に広げた網ですくい上げます。',
    note: '資源の減少が続くサンマは、国際的な漁獲枠で管理されています。',
    steps: [step('集魚灯をつける', '夜、強い光で魚の群れを船のそばへ集めます。', 5), step('網を広げる', '光の反対側に網を入れ、灯りを切り替えて魚を誘導します。'), step('すくい上げる', '網の縁を引き揚げて、魚をすくいます。')],
  },
  {
    id: 'diving', name: '潜水採集', cost: 1, time: 0.9,
    how: 'ダイバーが海に潜り、手網で生き物を1匹ずつ採集します。水族館の展示生物を傷つけずに集める代表的な方法です。',
    note: '必要な数だけを選んで採集でき、許可された海域と方法を守ることが前提です。',
    steps: [step('潜水の準備', '潜水計画を確認し、船を固定してエントリーします。'), step('海底へ潜る', 'ゆっくりと潜り、生き物を驚かせないように近づきます。'), step('手網で採集する', '手網に誘導し、傷つけないように容器へ移します。', 5)],
  },
];

export const getMethod = (id) => METHODS.find((m) => m.id === id);

/** 生き物ごとの主な捕り方 */
export const SPECIES_METHODS = {
  mejina: ['setnet', 'diving'], kasago: ['pots', 'gill'], hakofugu: ['setnet', 'diving'], ishidai: ['setnet', 'pole'],
  kakure: ['diving'], nanyouhagi: ['diving'], chocho: ['diving'], tsunodashi: ['diving'],
  maaji: ['purse', 'setnet'], mizukurage: ['diving', 'setnet'], shiira: ['pole', 'setnet'], manta: ['setnet'],
  kinmedai: ['longline'], mizuuo: ['longline', 'trawl'], mendako: ['trawl'], ryugu: ['setnet'],
  ainame: ['gill', 'pots'], madara: ['trawl', 'longline', 'gill'], sanma: ['bouke'], mola: ['setnet'],
  hokke: ['setnet', 'gill', 'trawl'], fuusen: ['diving', 'trawl'], clione: ['diving'], ookamiuo: ['gill', 'trawl'],
  tsubame: ['diving'], hagi2: ['diving'], tsumaguro: ['longline', 'gill'], napoleon: ['diving'],
  gingame: ['pole', 'diving'], kingangel: ['diving'], galashark: ['longline'], hammer: ['longline', 'setnet'],
};

/** その採取地で使える漁法と、それぞれで捕れる生き物 */
export function methodsAt(dest) {
  return METHODS.map((m) => ({ method: m, catches: dest.pool.filter((id) => SPECIES_METHODS[id]?.includes(m.id)) })).filter((x) => x.catches.length);
}
