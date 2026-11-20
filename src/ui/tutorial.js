/**
 * はじめての人向けのチュートリアル。画面のボタンを光る枠で示し、吹き出しで次の操作を案内する。
 * 実際の操作（採取・展示など）が終わると自動で次へ進む。進み具合は state.flags.tutorial に保存する。
 *   undefined: 未開始 / 数字: 進行中のステップ / 'done': 終了
 */
const yen = (n) => `¥${Math.floor(n).toLocaleString('ja-JP')}`;
const REWARD = 20000;

const STEPS = [
  { title: 'ようこそ、館長！', text: 'あなたの水族館がオープンしました。生き物を集めて展示し、来館者でにぎわう水族館に育てましょう。まずは基本の流れを案内します。' },
  { title: '館内を見わたす', text: '画面をドラッグすると回転、ピンチ（マウスはホイール）で拡大・縮小できます。左上のアイコンからは、階の移動や保存などのメニューが開きます。', target: '#hud-account' },
  { title: '採取に出かけよう', text: '「地図」を開いて採取地を選び、調査隊を出発させましょう。最初は近くの「相模湾」がおすすめです。', target: '#nav-map', done: (s) => s.trips > 0 || s.species > 0 },
  { title: '生き物を受け取る', text: '調査隊が戻るとメールが届きます。メールの「報告」タブで、採取した生き物を受け取りましょう。待つ間は館内を眺めていて大丈夫です。', target: '#side-mail', done: (s) => s.species > 0, skip: 'あとで受け取る' },
  { title: '水槽に展示する', text: '「アイテム」→「生物」で生き物を選び、数を決めて水槽に入れましょう。', target: '#nav-items', done: (s) => s.creatures > 0, skip: 'あとでやる' },
  { title: '水槽の中をレイアウト', text: '水槽をタップすると、飼育や掃除の状態が見られます。✎（水槽内編集）を押すと水槽の中に入り、岩やサンゴ、海藻を自由に置けます。', done: (s) => s.flags.interior, skip: '次へ' },
  { title: '来館者と資金', text: '展示が充実するほど来館者が増え、資金がたまります。資金で水槽を増やしたり、水族館を拡張しましょう。', target: '.hud-stat.money' },
  { title: '今月の特集イベント', text: '「イベント」では館内イベントの開催と、毎月変わる特集に挑戦できます。特集の生き物を展示すると来館者が増えます。', target: '#nav-event' },
];

export class Tutorial {
  constructor({ getState, getStats, economy, toast }) {
    Object.assign(this, { getState, getStats, economy, toast });
    this.el = document.createElement('div');
    this.el.id = 'tutorial';
    this.el.hidden = true;
    this.el.innerHTML = '<div class="tt-ring" hidden></div><div class="tt-card" role="dialog" aria-live="polite"></div>';
    document.body.append(this.el);
    this.ring = this.el.querySelector('.tt-ring');
    this.card = this.el.querySelector('.tt-card');
    this.card.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tt]');
      if (!b) return;
      if (b.dataset.tt === 'next') this._go(this.step + 1);
      else if (b.dataset.tt === 'skip') this._finish(false);
    });
    this._key = null;
  }

  get flags() {
    return this.getState().flags;
  }

  get step() {
    return typeof this.flags.tutorial === 'number' ? this.flags.tutorial : -1;
  }

  /** 読み込み後に呼ぶ：はじめての水族館なら開始、すでに遊んでいる人は案内しない */
  check() {
    const f = this.flags;
    if (f.tutorial !== undefined) return;
    const s = this.getStats();
    const fresh = !this.getState().goals.length && s.species === 0 && s.creatures === 0;
    f.tutorial = fresh ? 0 : 'done';
  }

  /** メニューから最初からやり直す */
  restart() {
    this.flags.tutorial = 0;
    this._key = null;
  }

  _go(i) {
    if (i >= STEPS.length) return this._finish(true);
    this.flags.tutorial = i;
    this._key = null;
  }

  _finish(completed) {
    const first = !this.flags.tutorialPaid;
    this.flags.tutorial = 'done';
    this.el.hidden = true;
    document.body.classList.remove('tutorial-on');
    if (completed && first) {
      this.flags.tutorialPaid = true;
      this.economy.earn(REWARD);
      this.toast(`チュートリアル完了！ ${yen(REWARD)} を獲得しました`);
    }
  }

  /** 毎フレーム：条件を満たしたら次へ、枠をボタンの位置に合わせる。visible=false の間（地図・訪問中など）は隠す */
  update(visible = true) {
    const i = this.step;
    const on = i >= 0 && visible;
    this.el.hidden = !on;
    document.body.classList.toggle('tutorial-on', i >= 0);
    if (!on) return;
    const st = STEPS[i];
    if (st.done?.(this.getStats())) return this._go(i + 1);
    if (this._key !== i) {
      this._key = i;
      const next = st.done ? `<button data-tt="next">${st.skip ?? '次へ'}</button>` : `<button data-tt="next" class="primary">${i === STEPS.length - 1 ? 'はじめる' : '次へ'}</button>`;
      this.card.innerHTML = `<small>チュートリアル ${i + 1}/${STEPS.length}</small><b>${st.title}</b><p>${st.text}</p>
        <div class="tt-acts"><button data-tt="skip" class="tt-skip">スキップ</button>${st.done ? '<em>操作すると次へ進みます</em>' : ''}${next}</div>`;
    }
    const t = st.target && document.querySelector(st.target);
    const r = t && t.offsetParent !== null ? t.getBoundingClientRect() : null;
    this.ring.hidden = !r;
    if (r) Object.assign(this.ring.style, { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px` });
    // 吹き出しは枠と重ならない側（枠が下半分なら上、上半分なら下）
    const low = r && r.top > innerHeight / 2;
    this.card.classList.toggle('above', !!low);
    this.card.classList.toggle('below', !!r && !low);
  }
}
