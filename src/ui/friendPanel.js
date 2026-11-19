/**
 * オンライン（アカウント・クラウド保存・フレンド・訪問）のシート。
 * 操作は online（src/online/online.js）と、main から渡すコールバックに委ねる。
 */
import { accountHtml, accountAction } from './accountView.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export class FriendPanel {
  constructor({ el, online, toast, onSave, onLoad, onVisit, onSignOut, beforeSignOut }) {
    Object.assign(this, { el, online, toast, onSave, onLoad, onVisit, onSignOut, beforeSignOut });
    this.view = 'main';
    this.busy = false;
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (btn) this._act(btn.dataset.act, btn.dataset.id);
    });
  }

  open() {
    this.view = this.online.recovery ? 'account' : 'main';
    this.el.hidden = false;
    this.render();
  }

  close() {
    this.el.hidden = true;
  }

  async render() {
    const o = this.online;
    if (!o.enabled) {
      this.el.innerHTML = `${this._head()}<p class="muted">オンライン機能はまだ設定されていません（Supabase の接続情報が必要です）。</p>`;
      return;
    }
    if (this.view === 'account') {
      this.el.innerHTML = `${this._head()}${accountHtml(o)}`;
      return;
    }
    this.el.innerHTML = `${this._head()}<p class="muted">読み込み中…</p>`;
    let list;
    try {
      list = await o.friends();
    } catch (err) {
      this.el.innerHTML = `${this._head()}<p class="muted">${esc(err.message)}</p>`;
      return;
    }
    const p = o.profile;
    const item = (f, buttons) => `<li><span>${esc(f.name)}</span><span class="fp-row">${buttons(f)}</span></li>`;
    const section = (title, arr, buttons) =>
      arr.length ? `<h4>${title}</h4><ul class="fp-list">${arr.map((f) => item(f, buttons)).join('')}</ul>` : '';
    this.el.innerHTML = `${this._head()}
      <div class="fp-me"><b class="fp-name">${esc(p.name)}</b><button data-act="account">アカウント設定</button></div>
      <div class="fp-me">フレンドコード <b class="fp-code">${esc(p.friend_code)}</b><button data-act="copy">コピー</button></div>
      <div class="fp-row"><button data-act="save" class="primary">☁ 保存</button><button data-act="load">☁ 読込</button></div>
      <h4>フレンドを追加</h4>
      <div class="fp-me"><input id="fp-code" placeholder="相手のフレンドコード" maxlength="8" autocapitalize="characters"><button data-act="request" class="primary">申請</button></div>
      ${section('届いた申請', list.incoming, (f) => `<button data-act="accept" data-id="${f.id}" class="primary">承認</button><button data-act="remove" data-id="${f.id}">拒否</button>`)}
      ${section('フレンド', list.friends, (f) => `<button data-act="visit" data-id="${f.id}" data-name="${esc(f.name)}" class="primary">訪問</button><button data-act="remove" data-id="${f.id}">解除</button>`)}
      ${section('申請中', list.outgoing, (f) => `<button data-act="remove" data-id="${f.id}">取消</button>`)}
      ${list.friends.length + list.incoming.length + list.outgoing.length ? '' : '<p class="muted">フレンドコードを教え合って追加しましょう。</p>'}
      <div class="fp-row end"><button data-act="signout">ログアウト</button></div>`;
  }

  _head() {
    return `<div class="fp-head"><h3>オンライン</h3><button data-act="close" class="icon" aria-label="閉じる">✕</button></div>`;
  }

  async _act(act, id) {
    if (act === 'close') return this.close();
    if (this.busy) return;
    const o = this.online;
    const val = (k) => this.el.querySelector(`#fp-${k}`)?.value.trim() ?? '';
    this.busy = true;
    try {
      if (act === 'account' || act === 'account-back') {
        this.view = act === 'account' ? 'account' : 'main';
      } else if (act === 'email' || act === 'password') {
        this.toast(await accountAction(act, o, this.el));
      } else if (act === 'signout') {
        await this.beforeSignOut();
        await o.signOut();
        return this.onSignOut();
      } else if (act === 'delete-account') {
        if (val('delete-confirm') !== '削除') return this.toast('確認欄に「削除」と入力してください', { error: true });
        await o.deleteAccount();
        return this.onSignOut();
      } else if (act === 'rename') {
        await o.rename(val('rename') || o.profile.friend_code);
        this.toast('表示名を変更しました');
      } else if (act === 'copy') {
        await navigator.clipboard?.writeText(o.profile.friend_code);
        this.toast('フレンドコードをコピーしました');
        return;
      } else if (act === 'save') return await this.onSave();
      else if (act === 'load') return await this.onLoad();
      else if (act === 'request') this.toast(await o.request(val('code')));
      else if (act === 'accept') {
        await o.accept(id);
        this.toast('フレンドになりました');
      } else if (act === 'remove') await o.remove(id);
      else if (act === 'visit') {
        const name = this.el.querySelector(`button[data-act="visit"][data-id="${id}"]`)?.dataset.name ?? 'フレンド';
        this.close();
        return await this.onVisit(id, name);
      }
      this.render();
    } catch (err) {
      this.toast(err.message, { error: true });
    } finally {
      this.busy = false;
    }
  }
}
