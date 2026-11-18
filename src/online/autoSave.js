/**
 * クラウドへの自動保存。
 * レイアウト等の変更は操作が落ち着いてから保存し、資金だけの変化は5分ごとにまとめる。
 * 画面を閉じる・裏へ回すときにも保存する。別の端末の新しいデータは上書きしない。
 */
const TICK_MS = 10_000;
const MAX_WAIT_MS = 30_000;
const MONEY_INTERVAL_MS = 300_000;

export class SaveConflict extends Error {}

/** 毎秒増える資金と保存時刻を除いた内容 */
const fingerprint = (s) => JSON.stringify({ ...s, savedAt: 0, economy: { ...s.economy, money: 0 }, ops: { ...s.ops, live: 0 } });

export class AutoSave {
  constructor({ save, getSnapshot, isPaused, onState, onConflict, now = () => Date.now() }) {
    Object.assign(this, { save, getSnapshot, isPaused, onState, onConflict, now });
    this.saving = null;
    this.blocked = false;
  }

  start() {
    this.markLoaded();
    setInterval(() => this.tick(), TICK_MS);
    const flush = () => this.flush();
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
    window.addEventListener('pagehide', flush);
  }

  /** 今の状態を「保存済み」として扱う（読込直後に呼ぶ） */
  markLoaded() {
    const s = this.getSnapshot();
    this.savedFp = this.lastFp = fingerprint(s);
    this.savedMoney = s.economy.money;
    this.savedAt = this.now();
    this.dirtySince = null;
    this.blocked = false;
    this.onState('saved');
  }

  get _idle() {
    return !this.blocked && !this.saving && !this.isPaused();
  }

  tick() {
    if (!this._idle) return;
    const s = this.getSnapshot();
    const fp = fingerprint(s);
    const t = this.now();
    if (fp !== this.savedFp) {
      this.dirtySince ??= t;
      const settled = fp === this.lastFp || t - this.dirtySince >= MAX_WAIT_MS;
      this.lastFp = fp;
      if (settled) return this._write(s, fp);
      return this.onState('dirty');
    }
    if (s.economy.money !== this.savedMoney && t - this.savedAt >= MONEY_INTERVAL_MS) return this._write(s, fp);
  }

  /** 未保存の内容があれば今すぐ保存する */
  async flush() {
    if (this.saving) await this.saving;
    if (!this._idle) return;
    const s = this.getSnapshot();
    const fp = fingerprint(s);
    if (fp !== this.savedFp || s.economy.money !== this.savedMoney) await this._write(s, fp);
  }

  /** 手動保存。失敗したら例外を投げる */
  async saveNow() {
    if (this.saving) await this.saving;
    if (this.blocked) throw new SaveConflict('別の端末で更新されています');
    const s = this.getSnapshot();
    if (!(await this._write(s, fingerprint(s)))) throw new Error('保存できませんでした。通信を確認してください');
  }

  /** 競合時に、この端末の内容で上書きする */
  async overwrite() {
    this.blocked = false;
    const s = this.getSnapshot();
    return this._write(s, fingerprint(s), true);
  }

  _write(s, fp, force = false) {
    this.onState('saving');
    this.saving = (async () => {
      try {
        await this.save(s, force);
        this.savedFp = this.lastFp = fp;
        this.savedMoney = s.economy.money;
        this.savedAt = this.now();
        this.dirtySince = null;
        this.onState('saved');
        return true;
      } catch (err) {
        if (err instanceof SaveConflict) {
          this.blocked = true;
          this.onState('conflict');
          this.onConflict();
        } else {
          console.error(err);
          this.onState('error'); // 次の周期で再試行
        }
        return false;
      } finally {
        this.saving = null;
      }
    })();
    return this.saving;
  }
}
