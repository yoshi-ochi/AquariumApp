/**
 * 認証データの生成（ビルド前に実行）。
 *   APP_PASSWORD … スプラッシュで入力するパスワード
 *   DATA_TOKEN   … 保存データ用プライベートリポジトリにだけ書き込める GitHub トークン
 *   DATA_REPO    … 保存先リポジトリ（既定 yoshi-ochi/AquariumApp-data）
 *
 * トークンをパスワードから導いた鍵（PBKDF2-SHA256 → AES-GCM）で暗号化し、public/auth.json に書き出す。
 * 公開されるのは暗号文だけで、パスワードもトークンもリポジトリには含まれない。
 *
 * 使い方：APP_PASSWORD=xxxx DATA_TOKEN=github_pat_xxx node scripts/make-auth.mjs
 */
import { webcrypto as crypto } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const ITERATIONS = 600000;
const { APP_PASSWORD, DATA_TOKEN, DATA_REPO = 'yoshi-ochi/AquariumApp-data' } = process.env;

if (!APP_PASSWORD || !DATA_TOKEN) {
  console.log('[make-auth] APP_PASSWORD / DATA_TOKEN が未設定のため auth.json を作りません（サイトはロックされたままになります）');
  process.exit(0);
}

const enc = new TextEncoder();
const b64 = (buf) => Buffer.from(buf).toString('base64');

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const baseKey = await crypto.subtle.importKey('raw', enc.encode(APP_PASSWORD), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
  baseKey,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
);
const payload = JSON.stringify({ token: DATA_TOKEN, repo: DATA_REPO, branch: 'main' });
const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(payload));

mkdirSync('public', { recursive: true });
writeFileSync('public/auth.json', JSON.stringify({ v: 1, iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(data) }));
console.log('[make-auth] public/auth.json を書き出しました');
