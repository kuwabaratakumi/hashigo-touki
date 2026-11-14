import { jstToday } from './schedule.js';
import { enrich, monthStrip, regionChips, viewCalendar, viewRegion, viewHashigo, esc } from './views.js';
// まわせ！はしご陶器市 — 全国の陶器市の日程と、同じ時期に回れる組み合わせ

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できなくても表示は続ける */ } },
};

const state = {
  fairs: [], groups: [], regions: [],
  view: store.get('hashigo-touki:view', 'calendar'),
  region: store.get('hashigo-touki:region', 'すべて'),
  month: '',
};
const $ = (s, el = document) => el.querySelector(s);

function render() {
  const today = jstToday();
  const items = enrich(state.fairs, today);
  if (state.region !== 'すべて' && !state.regions.includes(state.region)) state.region = 'すべて';
  document.querySelectorAll('.view button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
  $('#months').innerHTML = monthStrip(items.filter((x) => state.region === 'すべて' || x.fair.region === state.region), today, state.month);
  $('#regions').innerHTML = regionChips(items, state.regions, state.region);
  $('#main').innerHTML = state.view === 'hashigo' ? viewHashigo(items, today, state, state.groups)
    : state.view === 'region' ? viewRegion(items, today, state, state.regions)
    : viewCalendar(items, today, state);
}

function bind() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.view) { state.view = t.dataset.view; store.set('hashigo-touki:view', state.view); }
    else if (t.dataset.month !== undefined) { state.month = state.month === t.dataset.month ? '' : t.dataset.month; if (state.month) state.view = 'calendar'; }
    else if (t.dataset.region) { state.region = t.dataset.region; store.set('hashigo-touki:region', state.region); }
    else return;
    render();
    if (t.dataset.month) $('#main').scrollIntoView({ block: 'start' });
  });
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
