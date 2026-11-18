import { JOINT_PROJECTS, ALLIANCE_NEXT_XP, allianceLevel, allianceBonus, getCreature } from '../expedition/creatureData.js';
import { mulberry32 } from '../tanks/random.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;
const FUND_STEPS = [100000, 1000000, 10000000];
const REWARD_COUNT = 2;

/** 合同調査の成果（調査と本人ごとに固定） */
function rollReward(project, runId, userId) {
  let seed = 7;
  for (const ch of runId + userId) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
  const rand = mulberry32(seed);
  return Array.from({ length: REWARD_COUNT }, () => project.pool[Math.floor(rand() * project.pool.length)]);
}

/** 同盟水族館：加入・メンバー訪問・合同調査 */
export class AllianceView {
  constructor({ api, online, economy, expeditions, toast, onVisit, onChanged }) {
    Object.assign(this, { api, online, economy, expeditions, toast, onVisit, onChanged });
    this.list = null;
    this.error = '';
    this.loading = false;
  }

  /** シートを開くときに最新の情報を読む */
  async load(rerender) {
    this.loading = true;
    this.error = '';
    try {
      await this.api.refresh();
      this.list = this.api.state ? null : await this.api.list();
    } catch (err) {
      this.error = err.message;
    }
    this.loading = false;
    this.onChanged();
    rerender();
  }

  html() {
    if (this.error) return `<p class="gs-empty">${esc(this.error)}</p>`;
    if (this.loading && !this.api.state && !this.list) return '<p class="gs-empty">読み込み中…</p>';
    return this.api.state ? this._joined() : this._browse();
  }

  _browse() {
    const rows = (this.list ?? []).map((a) => `<div class="gs-row"><div class="gs-info"><b>${esc(a.name)}</b><small>Lv${allianceLevel(a.xp)} ・ ${a.count}人</small></div><button data-act="ally-join" data-id="${a.id}" class="primary">加入</button></div>`);
    return `<p class="gs-empty">同盟に入ると来館者が増え、仲間の水族館を訪問したり、合同調査に出資できます。</p>
      <div class="al-new"><input id="al-name" maxlength="16" placeholder="新しい同盟の名前" aria-label="新しい同盟の名前"><button data-act="ally-create" class="primary">設立</button></div>
      <h4 class="gs-sub">同盟を探す</h4>${rows.join('') || '<p class="gs-empty">まだ同盟がありません。</p>'}`;
  }

  _joined() {
    const { alliance: a, members, runs, contribs } = this.api.state;
    const level = allianceLevel(a.xp);
    const next = ALLIANCE_NEXT_XP[level];
    const bonus = Math.round((allianceBonus(level) - 1) * 100);
    const me = this.online.user.id;
    const memberRows = members.map((m) => `<div class="gs-row"><div class="gs-info"><b>${esc(m.name)}${m.id === a.owner ? ' ・ 盟主' : ''}</b><small>${m.lat == null ? '立地未設定' : '地図に表示中'}</small></div>${m.id === me ? '' : `<button data-act="ally-visit" data-id="${m.id}" data-name="${esc(m.name)}" class="primary">訪問</button>`}</div>`);
    const projects = JOINT_PROJECTS.map((p) => this._project(p, level, runs, contribs));
    return `<div class="st-sum"><div class="st-head"><b>${esc(a.name)} Lv${level}</b><small>来館者 +${bonus}%</small></div>
        <div class="st-bar"><i style="width:${next ? Math.min(100, (a.xp / next) * 100) : 100}%"></i></div>
        <small>${next ? `次のレベルまで ${(next - a.xp).toLocaleString('ja-JP')} 貢献` : '最大レベル'}</small></div>
      <h4 class="gs-sub">合同調査</h4>${projects.join('')}
      <h4 class="gs-sub">メンバー ${members.length}人</h4>${memberRows.join('')}
      <button data-act="ally-leave" class="al-leave">同盟を脱退</button>`;
  }

  _project(p, level, runs, contribs) {
    if (p.level > level) return `<div class="gs-row"><div class="gs-info"><b>${p.name}</b><small>同盟Lv${p.level}で解放 ・ 総額 ${yen(p.cost)}</small></div></div>`;
    const list = runs.filter((r) => r.project === p.id);
    const claimable = list.find((r) => r.done_at && new Date(r.done_at) <= new Date() && contribs.some((c) => c.run_id === r.id && !c.claimed));
    const running = list.find((r) => r.done_at && new Date(r.done_at) > new Date());
    const open = list.find((r) => !r.done_at);
    const funded = open?.funded ?? 0;
    const species = p.pool.map((id) => getCreature(id).name).join('、');
    const buttons = FUND_STEPS.map((n) => `<button data-act="ally-fund" data-id="${p.id}:${n}" ${this.economy.canAfford(n) ? '' : 'disabled'}>${n / 10000}万出資</button>`).join('');
    return `<div class="gs-row wrap"><div class="gs-info"><b>${p.name}</b><small>${p.text}</small><small>発見できる生物：${species}</small>
        ${running ? `<small>調査中 ・ 残り <span data-until="${new Date(running.done_at).getTime()}"></span></small>` : ''}
        <div class="st-bar"><i style="width:${(funded / p.cost) * 100}%"></i></div><small>資金 ${yen(funded)} / ${yen(p.cost)}（${p.hours}時間）</small></div>
      <div class="gs-btns">${claimable ? `<button data-act="ally-claim" data-id="${p.id}:${claimable.id}" class="primary">成果を受け取る</button>` : ''}${buttons}</div></div>`;
  }

  act(act, id, btn, rerender) {
    if (!act.startsWith('ally-')) return false;
    this._run(act, id, btn).catch((err) => this.toast(err.message, { error: true })).finally(() => { this.onChanged(); rerender(); });
    return true;
  }

  async _run(act, id, btn) {
    const api = this.api;
    if (act === 'ally-create') {
      const name = document.getElementById('al-name')?.value.trim();
      if (!name || name.length < 2) throw new Error('同盟の名前は2文字以上にしてください');
      await api.create(name);
      this.toast(`同盟「${name}」を設立しました`);
    } else if (act === 'ally-join') {
      await api.join(id);
      this.toast('同盟に加入しました');
    } else if (act === 'ally-leave') {
      await api.leave();
      this.list = await api.list();
      this.toast('同盟を脱退しました');
    } else if (act === 'ally-visit') {
      await this.onVisit(id, btn.dataset.name);
    } else if (act === 'ally-fund') {
      const [pid, n] = id.split(':');
      const amount = +n;
      if (!this.economy.spend(amount)) return;
      try {
        const taken = await api.fund(pid, amount);
        if (taken < amount) this.economy.earn(amount - taken); // 目標額を超えた分は返金
        this.toast(`${yen(taken)} を出資しました`);
      } catch (err) {
        this.economy.earn(amount);
        throw err;
      }
    } else if (act === 'ally-claim') {
      const [pid, runId] = id.split(':');
      if (!(await api.claim(runId))) return;
      const project = JOINT_PROJECTS.find((p) => p.id === pid);
      const got = rollReward(project, runId, this.online.user.id);
      got.forEach((c) => this.expeditions.discover(c));
      this.toast(`発見：${got.map((c) => getCreature(c).name).join('、')}`, { duration: 4000 });
    }
  }
}
