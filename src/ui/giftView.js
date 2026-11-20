import { getDestination } from '../expedition/creatureData.js';
import { catchBlocks } from './catchBlocks.js';

/**
 * プレゼント：帰還した調査隊の採取結果を受け取る。1隊ずつ、またはすべてまとめて受け取れる。
 * 受け取った生き物はブロック（サムネイル ×匹数）で表示する。
 */
export class GiftView {
  constructor({ expeditions, mailView, previews }) {
    Object.assign(this, { expeditions, mailView, previews });
    this.last = null; // 直前に受け取った結果 { got, released, trips }
  }

  get ready() {
    return this.expeditions.trips.filter((t) => this.expeditions.isDone(t));
  }

  html() {
    const ready = this.ready;
    const result = this.last
      ? `<div class="st-sum gf-result"><b>${this.last.trips}隊分を受け取りました</b>${catchBlocks(this.previews, this.last.got, this.last.released)}</div>`
      : '';
    const rows = ready.map((t) => `<div class="gs-row"><span class="gf-box">🎁</span><div class="gs-info"><b>${getDestination(t.dest).name}</b><small>調査隊が帰還しました</small></div><button data-act="gift-one" data-id="${t.seed}">受け取る</button></div>`);
    const all = ready.length ? `<button data-act="gift-all" class="primary tv-wide">すべて受け取る（${ready.length}件）</button>` : '';
    const empty = !ready.length && !this.last ? '<p class="gs-empty">受け取れる採取結果はありません。地図から調査隊を送り出すと、帰還したときにここへ届きます。</p>' : '';
    return `${result}${all}${rows.join('')}${empty}`;
  }

  act(act, id) {
    if (act === 'gift-all') this.last = this.mailView.claimTrips(this.ready.map((t) => t.seed));
    else if (act === 'gift-one') this.last = this.mailView.claimTrips([+id]);
    else return false;
    return true;
  }

  /** シートを閉じたら前回の結果は消す */
  reset() {
    this.last = null;
  }
}
