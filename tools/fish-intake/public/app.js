// 魚種追加ツールの画面
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// 合言葉は URL の ?t= から受け取り、端末に覚えておく
const urlToken = new URLSearchParams(location.search).get('t');
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
if (urlToken) { store.set('fish-intake-token', urlToken); history.replaceState(null, '', location.pathname); }
const TOKEN = urlToken ?? store.get('fish-intake-token') ?? '';

let data = { groups: [], species: [] };
let status = 'all';
let current = null;

async function api(method, path, body, headers = {}) {
  const res = await fetch(path, { method, body, headers: { 'X-Token': TOKEN, ...headers } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `エラー (${res.status})`);
  return json;
}
const q = (o) => new URLSearchParams(o).toString();
const imgUrl = (s, img) => `/api/image?${q(img.legacy ? { legacy: img.legacy, t: TOKEN } : { name: s.name, file: img.file, t: TOKEN })}`;

function toast(msg, error = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast${error ? ' error' : ''}`;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2600);
}

const hasImage = (s) => s.images.length > 0 || !!s.legacy;
const stateOf = (s) => (s.inGame ? 'game' : hasImage(s) ? 'todo' : 'none');
const BADGE = { game: ['実装済み', 'b-game'], todo: ['モデル待ち', 'b-todo'], none: ['画像なし', 'b-none'] };

async function load() {
  data = await api('GET', '/api/species');
  const sel = $('group-filter');
  const groups = [...new Set(data.species.map((s) => s.group))];
  const keep = sel.value;
  sel.innerHTML = '<option value="">すべてのゾーン</option>' + groups.map((g) => `<option>${esc(g)}</option>`).join('');
  sel.value = keep;
  $('add-group').innerHTML = data.groups.map((g) => `<option>${esc(g)}</option>`).join('');
  const n = (st) => data.species.filter((s) => stateOf(s) === st).length;
  $('summary').textContent = `${data.species.length}種 ・ 実装済み ${n('game')} ・ モデル待ち ${n('todo')} ・ 画像なし ${n('none')}`;
  render();
}

function render() {
  const word = $('search').value.trim();
  const group = $('group-filter').value;
  const list = data.species.filter((s) => (status === 'all' || stateOf(s) === status) && (!group || s.group === group) && (!word || s.name.includes(word)));
  const byGroup = new Map();
  for (const s of list) (byGroup.get(s.group) ?? byGroup.set(s.group, []).get(s.group)).push(s);
  $('list').innerHTML = list.length
    ? [...byGroup].map(([g, arr]) => `<section><h3>${esc(g)} <span>${arr.length}</span></h3><ul>${arr.map(item).join('')}</ul></section>`).join('')
    : '<p class="empty">該当する魚種がありません</p>';
}

function item(s) {
  const [label, cls] = BADGE[stateOf(s)];
  const main = s.images.find((i) => i.main) ?? (s.legacy ? { legacy: s.legacy } : s.images[0]);
  const thumb = main ? `<img src="${imgUrl(s, main)}" alt="" loading="lazy">` : '<span class="noimg">🐟</span>';
  const count = s.images.length + (s.legacy ? 1 : 0);
  return `<li><button class="row" data-name="${esc(s.name)}">${thumb}<span class="nm">${esc(s.name)}${count ? `<small>${count}枚</small>` : ''}</span><span class="badge ${cls}">${label}</span></button></li>`;
}

function openSheet(name) {
  current = data.species.find((s) => s.name === name);
  if (!current) return;
  renderSheet();
  $('memo').value = current.memo;
  $('sheet-status').textContent = '';
  if (!$('sheet').open) $('sheet').showModal();
}

function renderSheet() {
  const s = current;
  $('sheet-title').textContent = s.name;
  $('sheet-sub').textContent = `${s.group} ・ ${BADGE[stateOf(s)][0]}`;
  const legacy = s.legacy ? `<figure class="${s.images.some((i) => i.main) ? '' : 'main'}"><img src="${imgUrl(s, { legacy: s.legacy })}" alt="${esc(s.name)}（以前の参考画像）"><figcaption>以前の参考画像</figcaption></figure>` : '';
  $('thumbs').innerHTML = legacy + s.images.map((i) => `<figure class="${i.main ? 'main' : ''}">
      <img src="${imgUrl(s, i)}" alt="${esc(s.name)}の${i.main ? 'メイン' : '参考'}画像">
      <figcaption>${i.main ? 'メイン' : `<button data-main="${esc(i.file)}">メインにする</button>`}<button data-del="${esc(i.file)}" class="del" aria-label="削除">削除</button></figcaption>
    </figure>`).join('') || (legacy ? '' : '<p class="empty">まだ画像がありません</p>');
}

/** 大きな写真は長辺2400pxのJPEGに縮める（HEIC等も、端末で読めればJPEGになる） */
async function prepare(file) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    if (k === 1 && /^image\/(jpeg|png|webp)$/.test(file.type) && file.size < 8e6) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
  } catch {
    return file;
  }
}

async function upload(files, asMain) {
  const s = current;
  const total = files.length;
  for (let i = 0; i < total; i++) {
    $('sheet-status').textContent = `送信中… ${i + 1}/${total}`;
    const blob = await prepare(files[i]);
    await api('PUT', `/api/upload?${q({ name: s.name, main: asMain && i === 0 ? 1 : 0 })}`, blob, { 'Content-Type': blob.type || 'image/jpeg' });
  }
  $('sheet-status').textContent = '';
  toast(`${total}枚を保存しました`);
  await refresh();
}

async function refresh() {
  const name = current?.name;
  await load();
  if (name) {
    current = data.species.find((s) => s.name === name);
    renderSheet();
  }
}

async function guard(fn) {
  try {
    await fn();
  } catch (err) {
    $('sheet-status').textContent = '';
    toast(err.message, true);
  }
}

// ---- イベント ----------------------------------------------------------------
$('list').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-name]');
  if (b) openSheet(b.dataset.name);
});
$('search').addEventListener('input', render);
$('group-filter').addEventListener('change', render);
$('status-filter').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-status]');
  if (!b) return;
  status = b.dataset.status;
  for (const x of $('status-filter').children) x.classList.toggle('on', x === b);
  render();
});
$('sheet-close').addEventListener('click', () => $('sheet').close());
$('file-main').addEventListener('change', (e) => guard(() => upload([...e.target.files], true)).finally(() => (e.target.value = '')));
$('file-ref').addEventListener('change', (e) => guard(() => upload([...e.target.files], false)).finally(() => (e.target.value = '')));
$('thumbs').addEventListener('click', (e) => {
  const main = e.target.closest('[data-main]');
  const del = e.target.closest('[data-del]');
  if (main) guard(async () => { await api('POST', `/api/main?${q({ name: current.name, file: main.dataset.main })}`); await refresh(); });
  if (del && confirm('この画像を削除しますか？')) guard(async () => { await api('DELETE', `/api/image?${q({ name: current.name, file: del.dataset.del })}`); await refresh(); toast('削除しました'); });
});
$('memo-save').addEventListener('click', () => guard(async () => {
  await api('PUT', `/api/memo?${q({ name: current.name })}`, $('memo').value, { 'Content-Type': 'text/plain; charset=utf-8' });
  current.memo = $('memo').value;
  toast('メモを保存しました');
}));
$('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  guard(async () => {
    const name = $('add-name').value.trim();
    await api('POST', '/api/species', JSON.stringify({ name, group: $('add-group').value }), { 'Content-Type': 'application/json' });
    $('add-name').value = '';
    await load();
    toast(`${name} を追加しました`);
    openSheet(name);
  });
});

guard(load).catch(() => {});
if (!TOKEN) toast('PCで表示された「?t=」付きのURLから開いてください', true);
