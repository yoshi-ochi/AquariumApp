/**
 * オンライン（アカウント・クラウド保存・フレンド・訪問）のシート。
 * 操作は online（src/online/online.js）と、main から渡すコールバックに委ねる。
 */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export class FriendPanel {
  constructor({ el, online, toast, onSave, onLoad, onVisit }) {
    Object.assign(this, { el, online, toast, onSave, onLoad, onVisit });
    this.busy = false;
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (btn) this._act(btn.dataset.act, btn.dataset.id);
    });
  }

  open() {
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
    if (!o.user) {
      this.el.innerHTML = `${this._head()}
        <p class="muted">ログインすると、クラウド保存とフレンドの水族館の訪問ができます。</p>
        <input id="fp-name" placeholder="表示名（新規登録時）" maxlength="24" autocomplete="nickname">
        <input id="fp-email" type="email" placeholder="メールアドレス" autocomplete="email">
        <input id="fp-pass" type="password" placeholder="パスワード（6文字以上）" autocomplete="current-password">
        <div class="fp-row"><button data-act="signin" class="primary">ログイン</button><button data-act="signup">新規登録</button></div>`;
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
      <div class="fp-me">
        <input id="fp-rename" value="${esc(p.name)}" maxlength="24" aria-label="表示名"><button data-act="rename">変更</button>
      </div>
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
      if (act === 'signin') {
        await o.signIn(val('email'), val('pass'));
        this.toast(`ようこそ ${o.profile.name} さん`);
      } else if (act === 'signup') {
        const ok = await o.signUp(val('email'), val('pass'), val('name') || 'プレイヤー');
        this.toast(ok ? '登録しました' : '確認メールを送りました。メールのリンクを開いてからログインしてください');
      } else if (act === 'signout') {
        await o.signOut();
      } else if (act === 'rename') {
        await o.rename(val('rename') || 'プレイヤー');
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
