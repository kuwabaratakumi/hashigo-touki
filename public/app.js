import { jstToday } from './schedule.js';
import { enrich, monthStrip, regionChips, viewCalendar, viewRegion, viewHashigo, setFavs, esc } from './views.js';
// まわせ！はしご陶器市 — 全国の陶器市の日程と、同じ時期に回れる組み合わせ

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できなくても表示は続ける */ } },
};
const loadFavs = () => { const v = store.get('hashigo-touki:favs', []); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; };

const state = {
  fairs: [], groups: [], regions: [],
  view: store.get('hashigo-touki:view', 'calendar'),
  region: store.get('hashigo-touki:region', 'すべて'),
  month: '',
  favs: loadFavs(),                                   // お気に入りの id（このブラウザにだけ保存）
  favOnly: store.get('hashigo-touki:favOnly', false) === true,
  areaOpen: false,                                    // スマホで地方パネルを開いているか
};
const $ = (s, el = document) => el.querySelector(s);

function render() {
  const today = jstToday();
  const all = enrich(state.fairs, today);
  const ids = new Set(state.fairs.map((f) => f.id));
  const favSet = new Set(state.favs.filter((id) => ids.has(id)));   // 掲載をやめた陶器市の id は数えない
  setFavs(favSet);
  const items = state.favOnly ? all.filter((x) => favSet.has(x.fair.id)) : all;
  if (state.region !== 'すべて' && !state.regions.includes(state.region)) state.region = 'すべて';

  document.querySelectorAll('.view button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
  $('#favBtn').setAttribute('aria-pressed', String(state.favOnly));
  $('#favCount').textContent = favSet.size;
  $('#areaLabel').textContent = state.region;
  $('#areaBtn').setAttribute('aria-expanded', String(state.areaOpen));
  $('#areaBtn').toggleAttribute('data-active', state.region !== 'すべて');
  $('#regions').toggleAttribute('data-open', state.areaOpen);

  $('#months').innerHTML = monthStrip(items.filter((x) => state.region === 'すべて' || x.fair.region === state.region), today, state.month);
  $('#regions').innerHTML = regionChips(items, state.regions, state.region);

  const bar = state.favOnly ? `<div class="favbar"><span><b>お気に入り</b>だけを表示中</span><button type="button" class="btn btn--ghost" data-fav-toggle>すべて表示に戻す</button></div>` : '';
  const body = state.favOnly && !items.length
    ? '<p class="empty">まだお気に入りがありません。<br>気になる陶器市のカードにある ♡ を押すと、ここに集まります。</p>'
    : state.view === 'hashigo' ? viewHashigo(items, today, state, state.groups)
    : state.view === 'region' ? viewRegion(items, today, state, state.regions)
    : viewCalendar(items, today, state);
  $('#main').innerHTML = bar + body;
}

function closeArea() { if (!state.areaOpen) return false; state.areaOpen = false; return true; }

function bind() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    // パネルの外を押したら閉じる
    const closed = !e.target.closest('.areawrap') && closeArea();
    if (!t) { if (closed) render(); return; }

    if (t.dataset.fav) {
      const id = t.dataset.fav;
      state.favs = state.favs.includes(id) ? state.favs.filter((x) => x !== id) : [...state.favs, id];
      store.set('hashigo-touki:favs', state.favs);
    }
    else if (t.dataset.favToggle !== undefined) { state.favOnly = !state.favOnly; store.set('hashigo-touki:favOnly', state.favOnly); }
    else if (t.dataset.areaToggle !== undefined) { state.areaOpen = !state.areaOpen; }
    else if (t.dataset.view) { state.view = t.dataset.view; store.set('hashigo-touki:view', state.view); closeArea(); }
    else if (t.dataset.month !== undefined) { state.month = state.month === t.dataset.month ? '' : t.dataset.month; if (state.month) state.view = 'calendar'; closeArea(); }
    else if (t.dataset.region) { state.region = t.dataset.region; store.set('hashigo-touki:region', state.region); state.areaOpen = false; }
    else { if (closed) render(); return; }
    render();
    if (t.dataset.fav) document.querySelector(`[data-fav="${CSS.escape(t.dataset.fav)}"]`)?.focus();   // 描き直してもキー操作が途切れないように
    if (t.dataset.month) $('#main').scrollIntoView({ block: 'start' });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && closeArea()) { render(); $('#areaBtn').focus(); }
  });
  // 別のタブでお気に入りを変えたとき
  window.addEventListener('storage', (e) => { if (e.key === 'hashigo-touki:favs') { state.favs = loadFavs(); render(); } });
}

async function main() {
  try {
    const d = await fetch(`data/fairs.json?t=${Date.now()}`).then((r) => r.json());
    Object.assign(state, { fairs: d.fairs, groups: d.groups, regions: d.regions });
    $('#builtAt').textContent = `データ更新 ${new Date(d.builtAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
    bind();
    render();
  } catch (err) {
    $('#main').innerHTML = `<p class="empty">データを読み込めませんでした（${esc(err.message)}）</p>`;
  }
}
main();
