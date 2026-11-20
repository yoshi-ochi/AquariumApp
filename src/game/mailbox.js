/**
 * メール：採取の帰還・留守中の報告・1日の報告・掃除やエサの依頼などを届ける受信箱。
 * 各メールは key で重複を防ぐ（同じ出来事から2通届かない）。指示ボタンの処理は mailView.js が受け持つ。
 */
const MAX_MAILS = 60;
const MAX_KEYS = 300;
const today = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const newDay = (date = today()) => ({ date, income: 0, peak: 0, trips: 0, cleans: 0, feeds: 0, caught: 0 });

export class Mailbox extends EventTarget {
  constructor() {
    super();
    this.items = [];
    this.keys = []; // 届けたことのある key（削除後も同じ出来事で再送しない）
    this.seq = 0;
    this.day = newDay();
  }

  get unread() {
    return this.items.filter((m) => !m.read).length;
  }

  /** 指示や受け取りが残っているメール */
  get pending() {
    return this.items.filter((m) => m.actionable && !m.done).length;
  }

  has(key) {
    return this.keys.includes(key);
  }

  /** 新しいメールを届ける。同じ key は一度だけ */
  add({ key, kind, title, body, data = {}, actionable = false }) {
    if (key && this.has(key)) return null;
    const mail = { id: ++this.seq, key, kind, title, body, data, actionable, at: Date.now(), read: false, done: false };
    this.items.unshift(mail);
    if (key) {
      this.keys.push(key);
      if (this.keys.length > MAX_KEYS) this.keys.splice(0, this.keys.length - MAX_KEYS);
    }
    // 古いものから、済んだメールを優先して消す
    while (this.items.length > MAX_MAILS) {
      const i = this.items.findLastIndex((m) => m.done || !m.actionable);
      this.items.splice(i >= 0 ? i : this.items.length - 1, 1);
    }
    this._emit();
    return mail;
  }

  get(id) {
    return this.items.find((m) => m.id === id);
  }

  read(id) {
    const m = this.get(id);
    if (m && !m.read) {
      m.read = true;
      this._emit();
    }
  }

  readAll() {
    this.items.forEach((m) => (m.read = true));
    this._emit();
  }

  /** 受け取り・指示が済んだ。result は本文の下に残す結果 */
  finish(id, result) {
    const m = this.get(id);
    if (!m) return;
    Object.assign(m, { done: true, read: true, result });
    this._emit();
  }

  remove(id) {
    this.items = this.items.filter((m) => m.id !== id);
    this._emit();
  }

  /** 既読で、指示の要らない（または済んだ）メールを消す */
  clearDone() {
    this.items = this.items.filter((m) => !m.read || (m.actionable && !m.done));
    this._emit();
  }

  // ---- 1日の報告 ---------------------------------------------------------------

  /** 毎秒：その日の集計を進め、日付が変わっていたら前日の報告を届ける */
  tickDay({ incomePerSec, visitors }, now = Date.now()) {
    if (this.day.date !== today(now)) this.closeDay(now);
    this.day.income += incomePerSec;
    this.day.peak = Math.max(this.day.peak, visitors);
  }

  /** 出来事を数える（trips / cleans / feeds / caught） */
  count(field, n = 1) {
    if (this.day.date !== today()) this.closeDay();
    this.day[field] = (this.day[field] ?? 0) + n;
  }

  closeDay(now = Date.now()) {
    const d = this.day;
    this.day = newDay(today(now));
    if (!d.income && !d.trips && !d.cleans && !d.feeds) return;
    const [, m, dd] = d.date.split('-').map(Number);
    this.add({
      key: `daily:${d.date}`, kind: 'daily', title: `${m}月${dd}日の報告`,
      body: '昨日の営業のまとめです。',
      data: { ...d },
    });
  }

  // ---- 保存 ------------------------------------------------------------------

  toJSON() {
    return { items: this.items, keys: this.keys, seq: this.seq, day: this.day };
  }

  fromJSON(data) {
    this.items = Array.isArray(data?.items) ? data.items.slice(0, MAX_MAILS) : [];
    this.keys = Array.isArray(data?.keys) ? data.keys.slice(-MAX_KEYS) : [];
    this.seq = Math.max(data?.seq ?? 0, ...this.items.map((m) => m.id ?? 0));
    this.day = data?.day?.date ? { ...newDay(data.day.date), ...data.day } : newDay();
    // 閉じている間に日付が変わっていれば、その日の報告を届ける
    if (this.day.date !== today()) this.closeDay();
    this._emit();
  }

  _emit() {
    this.dispatchEvent(new Event('change'));
  }
}
