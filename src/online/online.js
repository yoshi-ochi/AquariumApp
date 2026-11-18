import { createClient } from '@supabase/supabase-js';

/**
 * オンライン機能（Supabase）：アカウント・セーブ・フレンド。
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が無いビルドでは enabled = false（オフラインのみ）。
 * 公開キー（anon）は公開前提の値。データの保護はデータベース側の行レベルセキュリティで行う。
 */
const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export class Online {
  constructor() {
    this.enabled = !!(URL_ && KEY);
    this.sb = this.enabled ? createClient(URL_, KEY) : null;
    this.user = null;
    this.profile = null;
  }

  _check(res) {
    if (res.error) throw new Error(res.error.message);
    return res.data;
  }

  // ---- アカウント ------------------------------------------------------------

  /** 保存済みのログイン状態を復元 */
  async restore() {
    if (!this.enabled) return null;
    const { data } = await this.sb.auth.getSession();
    this.user = data.session?.user ?? null;
    if (this.user) await this._loadProfile();
    return this.user;
  }

  async signUp(email, password, name) {
    const data = this._check(await this.sb.auth.signUp({ email, password, options: { data: { name } } }));
    this.user = data.session?.user ?? null; // メール確認が有効なら session は null
    if (this.user) await this._loadProfile();
    return !!this.user;
  }

  async signIn(email, password) {
    const data = this._check(await this.sb.auth.signInWithPassword({ email, password }));
    this.user = data.user;
    await this._loadProfile();
  }

  async signOut() {
    await this.sb.auth.signOut();
    this.user = this.profile = null;
  }

  async _loadProfile() {
    this.profile = this._check(await this.sb.from('profiles').select('*').eq('id', this.user.id).single());
  }

  async rename(name) {
    this._check(await this.sb.from('profiles').update({ name }).eq('id', this.user.id));
    this.profile.name = name;
  }

  // ---- セーブ ----------------------------------------------------------------

  async save(data) {
    this._check(await this.sb.from('saves').upsert({ user_id: this.user.id, data, updated_at: new Date().toISOString() }));
  }

  /** 自分（id 省略）またはフレンドのセーブ。無ければ null */
  async load(id = this.user.id) {
    const rows = this._check(await this.sb.from('saves').select('data').eq('user_id', id).limit(1));
    return rows[0]?.data ?? null;
  }

  // ---- フレンド --------------------------------------------------------------

  /** { friends, incoming, outgoing }：各要素は { id, name, friend_code } */
  async friends() {
    const me = this.user.id;
    const rows = this._check(await this.sb.from('friendships').select('requester, addressee, status'));
    const ids = [...new Set(rows.flatMap((r) => [r.requester, r.addressee]).filter((x) => x !== me))];
    const profs = ids.length ? this._check(await this.sb.from('profiles').select('id, name, friend_code').in('id', ids)) : [];
    const byId = new Map(profs.map((p) => [p.id, p]));
    const out = { friends: [], incoming: [], outgoing: [] };
    for (const r of rows) {
      const other = byId.get(r.requester === me ? r.addressee : r.requester);
      if (!other) continue;
      if (r.status === 'accepted') out.friends.push(other);
      else (r.addressee === me ? out.incoming : out.outgoing).push(other);
    }
    return out;
  }

  /** フレンドコードで申請（相手から申請が来ていればそのまま承認） */
  async request(code) {
    const c = code.trim().toUpperCase();
    const rows = this._check(await this.sb.from('profiles').select('id, name').eq('friend_code', c).limit(1));
    const target = rows[0];
    if (!target) throw new Error('そのフレンドコードは見つかりません');
    if (target.id === this.user.id) throw new Error('自分のコードです');
    const back = this._check(
      await this.sb.from('friendships').select('status').eq('requester', target.id).eq('addressee', this.user.id).limit(1),
    );
    if (back.length) {
      await this.accept(target.id);
      return `${target.name} さんとフレンドになりました`;
    }
    const res = await this.sb.from('friendships').insert({ requester: this.user.id, addressee: target.id });
    if (res.error?.code === '23505') throw new Error('すでに申請済みです');
    this._check(res);
    return `${target.name} さんに申請しました`;
  }

  async accept(id) {
    this._check(await this.sb.from('friendships').update({ status: 'accepted' }).eq('requester', id).eq('addressee', this.user.id));
  }

  /** 申請の取り消し・拒否・フレンド解除 */
  async remove(id) {
    const me = this.user.id;
    this._check(await this.sb.from('friendships').delete().or(`and(requester.eq.${me},addressee.eq.${id}),and(requester.eq.${id},addressee.eq.${me})`));
  }
}
