/**
 * 色つきのイラストアイコン（64×64）。店舗運営の商品と、同盟の合同調査（船・ROV・砕氷船）。
 */
const svg = (body, label) => `<svg class="art-ico" viewBox="0 0 64 64" role="img" aria-label="${label}">${body}</svg>`;

const ART = {
  // ポストカード：海と魚の絵はがき（切手と宛名の線）
  postcard: ['ポストカード', `
    <rect x="6" y="12" width="52" height="40" rx="3" fill="#fffaf0" stroke="#c9b48a" stroke-width="2"/>
    <rect x="9" y="15" width="26" height="34" rx="2" fill="#4fb3d9"/>
    <path d="M9 38c5-3 9 3 14 0s8-3 12 0v11H9z" fill="#2e86b8"/>
    <path d="M14 28c3-4 9-4 12 0-3 4-9 4-12 0z" fill="#ffb347"/><path d="M26 28l4-3v6z" fill="#ffb347"/><circle cx="17" cy="27.5" r="1" fill="#333"/>
    <rect x="45" y="17" width="9" height="11" rx="1" fill="#f2665a" stroke="#fff" stroke-width="1.5" stroke-dasharray="2 1"/>
    <path d="M39 34h15M39 40h15M39 46h12" stroke="#b9a37a" stroke-width="2" stroke-linecap="round"/>`],
  // キーホルダー：金具の輪と魚のチャーム
  keyholder: ['キーホルダー', `
    <circle cx="20" cy="16" r="9" fill="none" stroke="#b8c2cc" stroke-width="4"/>
    <path d="M26 22l6 8" stroke="#b8c2cc" stroke-width="3" stroke-linecap="round"/>
    <path d="M24 42c6-12 22-14 30-4-8 11-24 10-30 4z" fill="#ff8c42"/>
    <path d="M28 40c5-2 10-2 14 0" stroke="#fff" stroke-width="3" fill="none"/>
    <path d="M24 42l-10-7 2 9-2 8z" fill="#ff8c42"/><circle cx="48" cy="38" r="2" fill="#222"/>
    <circle cx="33" cy="31" r="2.5" fill="#d9e1e8" stroke="#8a96a3"/>`],
  // ぬいぐるみ：丸いジンベエザメ
  plush: ['ぬいぐるみ', `
    <path d="M8 36c0-12 14-20 30-18 12 1 18 8 18 16 0 10-12 16-28 16C16 50 8 45 8 36z" fill="#4a6c9b"/>
    <path d="M10 40c6 6 18 9 30 7 8-1 14-5 16-11-2 10-14 15-28 15C18 51 11 47 10 40z" fill="#e8eef4"/>
    <path d="M30 18l6-10 4 11z" fill="#3f5d87"/><path d="M54 30l8-8-2 12 2 10-8-6z" fill="#3f5d87"/>
    <g fill="#fff"><circle cx="24" cy="28" r="1.6"/><circle cx="31" cy="25" r="1.6"/><circle cx="38" cy="27" r="1.6"/><circle cx="44" cy="31" r="1.6"/><circle cx="30" cy="32" r="1.6"/><circle cx="37" cy="33" r="1.6"/></g>
    <circle cx="16" cy="34" r="2.6" fill="#1b1b1b"/><circle cx="16.8" cy="33.2" r=".8" fill="#fff"/>
    <path d="M10 40q4 3 9 1" stroke="#1b1b1b" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <ellipse cx="13" cy="38" rx="2.2" ry="1.3" fill="#f4a4b4"/>`],
  // 海の生き物図鑑：表紙に魚とタイトル帯
  book: ['海の生き物図鑑', `
    <path d="M12 8h36a4 4 0 0 1 4 4v42H16a4 4 0 0 1-4-4z" fill="#1f6fa8"/>
    <path d="M16 54a4 4 0 0 1 0-8h36v8z" fill="#f4f1e8"/><path d="M16 54a4 4 0 0 1 0-8" fill="none" stroke="#c9c2ae" stroke-width="1.5"/>
    <rect x="18" y="13" width="28" height="7" rx="1.5" fill="#ffd36b"/>
    <path d="M20 33c5-7 15-7 20 0-5 7-15 7-20 0z" fill="#ff8c42"/><path d="M40 33l6-5v10z" fill="#ff8c42"/>
    <path d="M27 28v10M33 27v12" stroke="#fff" stroke-width="2"/><circle cx="23.5" cy="32" r="1.2" fill="#222"/>
    <path d="M22 42c4 1 8-1 12 0s8 1 10 0" stroke="#7fc8e8" stroke-width="2" fill="none"/>`],
  // 精密フィギュア：台座に乗ったシャチ
  model: ['精密フィギュア', `
    <ellipse cx="32" cy="52" rx="20" ry="5" fill="#6b4e33"/><rect x="12" y="46" width="40" height="6" fill="#86623f"/><ellipse cx="32" cy="46" rx="20" ry="5" fill="#a07a50"/>
    <rect x="30" y="34" width="4" height="12" fill="#c9ced3"/>
    <path d="M8 26c6-10 26-14 40-6 6 3 9 8 8 12-10 2-30 3-42-1-4-1-6-3-6-5z" fill="#1d1f24"/>
    <path d="M14 30c10 3 26 3 38 0-2 3-6 5-12 6-10 1-20 0-26-6z" fill="#f2f4f6"/>
    <ellipse cx="18" cy="24" rx="4" ry="2" fill="#f2f4f6"/><path d="M30 18l4-12 5 13z" fill="#1d1f24"/>
    <path d="M52 26l8-6-2 8 3 6-8-3z" fill="#1d1f24"/>`],
  // 調査船：観測用の船と、船尾のクレーン
  ship: ['調査船', `
    <path d="M0 50c6 0 6-3 12-3s6 3 12 3 6-3 12-3 6 3 12 3 6-3 12-3 4 3 4 3v14H0z" fill="#2e86b8"/>
    <path d="M6 40h52l-7 10H13z" fill="#e8eef2"/><path d="M6 40h52l-1 3H7z" fill="#d6463c"/>
    <rect x="18" y="28" width="22" height="12" rx="1" fill="#f7f9fa" stroke="#9aa6b0"/>
    <rect x="22" y="20" width="12" height="8" fill="#f7f9fa" stroke="#9aa6b0"/>
    <g fill="#5fa8d3"><rect x="21" y="31" width="4" height="3"/><rect x="27" y="31" width="4" height="3"/><rect x="33" y="31" width="4" height="3"/><rect x="24" y="22" width="8" height="3"/></g>
    <path d="M28 20V12M28 12l6 2" stroke="#6b7680" stroke-width="2"/><circle cx="28" cy="11" r="2" fill="#ffd36b"/>
    <path d="M46 40V24l8 6" stroke="#f2a33a" stroke-width="3" fill="none"/><path d="M54 30v8" stroke="#6b7680" stroke-width="1.5"/>`],
  // ROV：黄色い無人潜水機、ライトとスラスター、つながるケーブル
  rov: ['ROV', `
    <rect width="64" height="64" fill="#0d3350" rx="6"/>
    <path d="M32 0c0 6 4 8 4 12" stroke="#ffb84d" stroke-width="2" fill="none"/>
    <rect x="12" y="14" width="40" height="14" rx="3" fill="#ffc72c"/>
    <rect x="12" y="28" width="40" height="16" rx="2" fill="none" stroke="#c9ced3" stroke-width="3"/>
    <rect x="18" y="31" width="10" height="9" rx="2" fill="#2f3a44"/><rect x="36" y="31" width="10" height="9" rx="2" fill="#2f3a44"/>
    <circle cx="14" cy="36" r="3" fill="#fffbe0"/><circle cx="50" cy="36" r="3" fill="#fffbe0"/>
    <path d="M14 36l-12 8M50 36l12 8" stroke="#fff6b0" stroke-width="5" opacity=".35"/>
    <path d="M24 44l-6 10M40 44l6 10" stroke="#c9ced3" stroke-width="3"/><path d="M14 54h10M40 54h10" stroke="#c9ced3" stroke-width="3"/>
    <circle cx="32" cy="21" r="3" fill="#2f3a44"/><circle cx="32" cy="21" r="1.4" fill="#7fd3ff"/>`],
  // 砕氷船：赤い船体と氷山
  polar: ['砕氷船', `
    <path d="M40 46l8-20 6 6 6 14z" fill="#e6f4fb"/><path d="M48 26l6 6-4 14h-10z" fill="#b8dcef"/>
    <path d="M0 50c6 0 6-3 12-3s6 3 12 3 6-3 12-3 6 3 12 3 6-3 12-3 4 3 4 3v14H0z" fill="#3b7fa8"/>
    <path d="M4 38h40l-6 12H12z" fill="#d6463c"/><path d="M4 38h40l-1 3H5z" fill="#2b2f36"/>
    <rect x="12" y="26" width="18" height="12" fill="#f7f9fa" stroke="#9aa6b0"/>
    <rect x="16" y="20" width="10" height="6" fill="#f7f9fa" stroke="#9aa6b0"/>
    <g fill="#5fa8d3"><rect x="14" y="29" width="4" height="3"/><rect x="20" y="29" width="4" height="3"/><rect x="18" y="22" width="6" height="2.5"/></g>
    <rect x="31" y="22" width="5" height="16" fill="#f2a33a"/><rect x="31" y="22" width="5" height="3" fill="#2b2f36"/>
    <path d="M44 38l6 6-4 4" fill="#f0f8fc"/>`],
};

/** 商品・合同調査のアイコン（無ければ空） */
export const artIcon = (id) => (ART[id] ? svg(ART[id][1], ART[id][0]) : '');
