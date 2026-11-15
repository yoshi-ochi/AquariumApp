/**
 * スプラッシュ画面のパスワード入力。
 * auth.json（ビルド時にパスワードで暗号化された保存用トークン）を、入力されたパスワードで復号できたら入場。
 * 復号した { token, repo, branch } はメモリ上だけで使い、保存しない。
 *
 * 開発サーバーで auth.json が無いときは、パスワードなしで入れる（保存はファイルのみ）。
 */
import { normalizePassword } from './normalize.js';

const $ = (id) => document.getElementById(id);

function fromB64(s) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function decrypt(auth, password) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(auth.salt), iterations: auth.iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(auth.iv) }, key, fromB64(auth.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

async function loadAuth() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}auth.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * パスワードを入れて入場するまで待つ。
 * @returns {Promise<{ token: string, repo: string, branch: string } | null>} クラウド保存の接続情報（無ければ null）
 */
export async function unlock() {
  const auth = await loadAuth();
  const box = $('gate');
  const input = $('gate-password');
  const msg = $('gate-message');
  const btn = $('gate-submit');
  box.hidden = false;

  if (!auth && import.meta.env.DEV) {
    msg.textContent = '開発モード：パスワードなしで入れます';
  } else if (!auth) {
    msg.textContent = '公開設定が完了していないため、まだ入場できません';
    input.disabled = true;
    btn.disabled = true;
    return new Promise(() => {}); // 入場させない
  }
  input.focus();

  return new Promise((resolve) => {
    const tryEnter = async () => {
      if (!auth) {
        box.hidden = true;
        return resolve(null);
      }
      btn.disabled = true;
      msg.textContent = '確認中…';
      try {
        const cred = await decrypt(auth, normalizePassword(input.value));
        box.hidden = true;
        resolve(cred);
      } catch {
        msg.textContent = 'パスワードが違います';
        box.classList.remove('shake');
        void box.offsetWidth; // アニメーションをやり直す
        box.classList.add('shake');
        input.select();
      } finally {
        btn.disabled = false;
      }
    };
    btn.addEventListener('click', tryEnter);
    input.addEventListener('keydown', (e) => e.key === 'Enter' && tryEnter());
  });
}
