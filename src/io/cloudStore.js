/**
 * 保存データ用プライベートリポジトリ（GitHub Contents API）への保存・読込。
 * 接続情報（token / repo / branch）はスプラッシュでパスワードを入れたときに復号したもの。
 */
const PATH = 'layouts/latest.json';
const API = 'https://api.github.com';

function headers(cred, accept = 'application/vnd.github+json') {
  return { Authorization: `Bearer ${cred.token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' };
}

function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export class CloudStore {
  constructor(cred) {
    this.cred = cred;
  }

  get url() {
    return `${API}/repos/${this.cred.repo}/contents/${PATH}`;
  }

  /** 保存済みレイアウトを読む（まだ無ければ null） */
  async load() {
    const res = await fetch(`${this.url}?ref=${this.cred.branch}`, { headers: headers(this.cred, 'application/vnd.github.raw+json'), cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`読込に失敗しました（${res.status}）`);
    return res.json();
  }

  /** レイアウトを保存（上書きコミット） */
  async save(data) {
    // 既存ファイルの sha（上書きに必要）
    let sha;
    const head = await fetch(`${this.url}?ref=${this.cred.branch}`, { headers: headers(this.cred), cache: 'no-store' });
    if (head.ok) sha = (await head.json()).sha;
    else if (head.status !== 404) throw new Error(`保存に失敗しました（${head.status}）`);

    const res = await fetch(this.url, {
      method: 'PUT',
      headers: { ...headers(this.cred), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `レイアウトを保存 ${new Date().toISOString()}`,
        content: utf8ToB64(JSON.stringify(data, null, 2)),
        branch: this.cred.branch,
        ...(sha && { sha }),
      }),
    });
    if (!res.ok) throw new Error(`保存に失敗しました（${res.status}）`);
  }
}
