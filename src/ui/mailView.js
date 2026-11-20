import { getCreature, getDestination } from '../expedition/creatureData.js';
import { isHungry, feedCost, hasLife } from '../expedition/husbandry.js';
import { cleanSpec, isCleaning, needsCleaning } from '../tanks/tankCleaning.js';
import { tankLabel } from '../tanks/tankLabel.js';
import { icon } from './icons.js';
import { catchBlocks, countIds } from './catchBlocks.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;
const num = (n) => Math.floor(n).toLocaleString('ja-JP');
const when = (t) => {
  const d = new Date(t);
  const sameDay = new Date().toDateString() === d.toDateString();
  const hm = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
};
const KIND_ICON = { trip: 'expedition', offline: 'coin', daily: 'mail', clean: 'clean', feed: 'care', order: 'items' };
const label = (list) => [...new Set(list)].map((c) => `${getCreature(c).name}×${list.filter((x) => x === c).length}`).join('、');

/**
 * メール画面：受信箱の一覧と、メールからの受け取り・指示。
 * scan() を毎秒呼ぶと、帰還した調査隊・汚れた水槽・空腹の水槽をメールで知らせる。
 */
export class MailView {
  constructor({ mailbox, manager, expeditions, economy, ops, cleanView, careView, previews, toast }) {
    Object.assign(this, { mailbox, manager, expeditions, economy, ops, cleanView, careView, previews, toast });
    this.open = null;
  }

  // ---- メールを届ける ------------------------------------------------------------

  scan(now = Date.now()) {
    const mb = this.mailbox;
    for (const trip of this.expeditions.trips) {
      if (!this.expeditions.isDone(trip, now)) continue;
      const d = getDestination(trip.dest);
      mb.add({ key: `trip:${trip.seed}`, kind: 'trip', title: `${d.name}の調査隊が帰還しました`, body: '採取した生き物を受け取れます。', data: { seed: trip.seed }, actionable: true });
    }
    const keepersShort = this.ops.staff.keeper < this.ops.required.keeper;
    for (const t of this.manager.tanks) {
      const uid = t.userData.uid;
      if (needsCleaning(t, now)) {
        mb.add({ key: `clean:${uid}:${t.userData.clean?.last ?? 0}`, kind: 'clean', title: `${tankLabel(this.manager, t)} の掃除が必要です`, body: '水が汚れて集客が落ちています。掃除を指示してください。', data: { uid }, actionable: true });
      }
      // 飼育員が足りているときは自動でエサをあげるので、足りないときだけ知らせる
      if (keepersShort && hasLife(t) && isHungry(t, now)) {
        mb.add({ key: `feed:${uid}:${t.userData.care?.fed ?? 0}`, kind: 'feed', title: `${tankLabel(this.manager, t)} の生き物がお腹をすかせています`, body: '飼育員が足りないため、エサやりの指示が必要です。', data: { uid }, actionable: true });
      }
    }
    // 他の画面で対応済みになったものは閉じる
    for (const m of mb.items) {
      if (!m.actionable || m.done) continue;
      const t = this.manager.objects.get(m.data.uid);
      if (m.kind === 'trip' && !this.expeditions.trips.some((x) => x.seed === m.data.seed)) mb.finish(m.id, '受け取り済みです');
      else if (m.kind === 'clean' && (!t || !needsCleaning(t, now))) mb.finish(m.id, !t ? '水槽がありません' : isCleaning(t) ? '掃除を始めています' : '対応済みです');
      else if (m.kind === 'feed' && (!t || !isHungry(t, now))) mb.finish(m.id, '対応済みです');
    }
  }

  /** 帰還した隊（seed で指定）の成果をまとめて受け取り、対応するメールを閉じる。{ got, released, trips } を返す */
  claimTrips(seeds) {
    const ex = this.expeditions;
    const all = { got: [], released: [], trips: 0 };
    for (const seed of seeds) {
      const i = ex.trips.findIndex((x) => x.seed === seed);
      if (i < 0 || !ex.isDone(ex.trips[i])) continue;
      const got = ex.claim(i);
      const released = [...ex.released];
      all.got.push(...got);
      all.released.push(...released);
      all.trips++;
      const mail = this.mailbox.items.find((m) => m.key === `trip:${seed}`);
      if (mail) {
        mail.data.got = countIds(got);
        mail.data.released = countIds(released);
        this.mailbox.finish(mail.id, got.length || released.length ? '受け取りました' : '持ち帰れる生き物はいませんでした');
      }
    }
    if (all.trips) {
      const text = `${label(all.got) || '持ち帰れる生き物はいませんでした'}${all.released.length ? `／満杯のため放流：${label(all.released)}` : ''}`;
      this.toast(`採取結果を受け取りました：${text}`, { duration: 4000 });
    }
    return { got: countIds(all.got), released: countIds(all.released), trips: all.trips };
  }

  // ---- 画面 ----------------------------------------------------------------------

  html() {
    const mb = this.mailbox;
    if (!mb.items.length) return '<p class="gs-empty">メールはありません。採取の帰還や1日の報告、水槽の掃除の依頼などが届きます。</p>';
    const head = `<div class="ml-tools"><small>未読 ${mb.unread}件 ・ 対応待ち ${mb.pending}件</small><button data-act="mail-read-all" ${mb.unread ? '' : 'disabled'}>すべて既読</button><button data-act="mail-clear">既読を整理</button></div>`;
    return head + mb.items.map((m) => this._row(m)).join('');
  }

  _row(m) {
    const open = this.open === m.id;
    const state = m.actionable && !m.done ? '<i class="ml-todo">要対応</i>' : '';
    const top = `<button class="ml-head ${m.read ? '' : 'unread'}" data-act="mail-open" data-id="${m.id}"><span class="ml-ico">${icon(KIND_ICON[m.kind] ?? 'mail', 20)}</span><span class="ml-title">${esc(m.title)}</span>${state}<small>${when(m.at)}</small></button>`;
    if (!open) return `<div class="ml-mail">${top}</div>`;
    const result = m.result ? `<p class="ml-result">${esc(m.result)}</p>` : '';
    const actions = m.done ? '' : this._actions(m);
    return `<div class="ml-mail open">${top}<div class="ml-body"><p>${esc(m.body)}</p>${this._detail(m)}${result}<div class="gs-btns">${actions}<button data-act="mail-del" data-id="${m.id}">削除</button></div></div></div>`;
  }

  _detail(m) {
    const d = m.data;
    if (m.kind === 'trip' && d.got) return catchBlocks(this.previews, d.got, d.released);
    if (m.kind === 'daily') {
      return `<dl class="ml-dl"><dt>入館料などの収入</dt><dd>${yen(d.income)}</dd><dt>来館者（最大）</dt><dd>${num(d.peak)}人</dd><dt>帰還した調査隊</dt><dd>${d.trips}隊（${d.caught}匹）</dd><dt>掃除した水槽</dt><dd>${d.cleans}基</dd></dl>`;
    }
    if (m.kind === 'offline') {
      return `<dl class="ml-dl"><dt>来館者</dt><dd>${num(d.visitors)}人</dd><dt>入館料</dt><dd>${yen(d.income)}</dd><dt>賃金</dt><dd>−${yen(d.wages)}</dd><dt>受け取り</dt><dd><b>${yen(d.net)}</b></dd></dl>${d.capped ? `<small>計算されるのは最大${d.capped}時間までです。</small>` : ''}`;
    }
    return '';
  }

  _actions(m) {
    const btn = (act, text, ok = true, primary = true) => `<button data-act="${act}" data-id="${m.id}" class="${primary ? 'primary' : ''}" ${ok ? '' : 'disabled'}>${text}</button>`;
    if (m.kind === 'trip') return btn('mail-claim', '受け取る');
    if (m.kind === 'offline') return btn('mail-take', `受け取る ${yen(m.data.net)}`);
    const t = this.manager.objects.get(m.data.uid);
    if (!t) return '';
    if (m.kind === 'clean') {
      const spec = cleanSpec(t.userData.defId);
      const free = this.ops.staff.cleaner - this.manager.tanks.reduce((s, x) => s + (x.userData.clean?.crew ?? 0), 0);
      return [
        spec.staff ? btn('mail-clean-staff', `職員${spec.staff.crew}人で掃除 ${yen(spec.staff.cost)}`, free >= spec.staff.crew && this.economy.canAfford(spec.staff.cost)) : '',
        spec.diver ? btn('mail-clean-diver', `ダイバーで掃除 ${yen(spec.diver.cost)}`, this.economy.canAfford(spec.diver.cost), !spec.staff) : '',
      ].join('');
    }
    if (m.kind === 'feed') return btn('mail-feed', `エサやり ${yen(feedCost(t))}`, this.economy.canAfford(feedCost(t)));
    return '';
  }

  act(act, id) {
    if (!act.startsWith('mail-')) return false;
    const mb = this.mailbox;
    if (act === 'mail-read-all') return mb.readAll(), true;
    if (act === 'mail-clear') return mb.clearDone(), (this.open = null), true;
    const m = mb.get(+id);
    if (!m) return true;
    if (act === 'mail-open') {
      this.open = this.open === m.id ? null : m.id;
      mb.read(m.id);
    } else if (act === 'mail-del') {
      if (m.actionable && !m.done && !confirm('まだ対応していないメールです。削除しますか？')) return true;
      mb.remove(m.id);
    } else if (act === 'mail-take') {
      this.economy.earn(m.data.net);
      mb.finish(m.id, `${yen(m.data.net)} を受け取りました`);
    } else if (act === 'mail-claim') {
      if (!this.claimTrips([m.data.seed]).trips) mb.finish(m.id, '受け取り済みです');
    } else if (act === 'mail-clean-staff' || act === 'mail-clean-diver') {
      const t = this.manager.objects.get(m.data.uid);
      if (t) this.cleanView.act(act.replace('mail-', ''), String(m.data.uid));
      if (t && isCleaning(t)) mb.finish(m.id, act === 'mail-clean-staff' ? '職員に掃除を指示しました' : 'ダイバーに掃除を依頼しました');
    } else if (act === 'mail-feed') {
      const t = this.manager.objects.get(m.data.uid);
      if (t) this.careView.act('care-feed', String(m.data.uid));
      if (t && !isHungry(t)) mb.finish(m.id, 'エサをあげました');
    }
    return true;
  }
}
