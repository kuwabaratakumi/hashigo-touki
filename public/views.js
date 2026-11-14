// 画面の部品（HTML文字列を作るだけ。DOM には触らない）
import { nextOccurrence, lastHeld, monthsOf, overlapSets, diffDays, addDays } from './schedule.js';

const DOW = ['日', '月', '火', '水', '木', '金', '土'];
export const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
const mdw = (iso) => `${md(iso)}（${DOW[new Date(iso + 'T12:00:00Z').getUTCDay()]}）`;
const range = (s, e) => (e ? (e === s ? mdw(s) : `${mdw(s)}〜${mdw(e)}`) : `${mdw(s)}〜`);
const gmaps = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const gsearch = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
const STATE_LABEL = { now: '開催中', confirmed: '日程発表済', expected: '例年どおりなら', month: '時期のみ', unknown: '時期不明' };

/** 一覧に「次の開催」「前回」を足す */
export function enrich(fairs, today) {
  return fairs.map((fair) => ({ fair, next: nextOccurrence(fair, today), last: lastHeld(fair, today) }))
    .sort((a, b) => a.next.sortKey.localeCompare(b.next.sortKey) || a.fair.name.localeCompare(b.fair.name, 'ja'));
}

export function whenText(n) {
  if (n.state === 'month') return `${n.year}年${n.month}月${n.part || 'ごろ'}`;
  if (!n.start) return '時期は公式で確認';
  return `${n.start.slice(0, 4)}年 ${range(n.start, n.end)}`;
}

function countdown(n, today) {
  if (n.state === 'now' || n.running) return '';
  if (!n.start) return '';
  const d = diffDays(today, n.start);
  return `<span class="count">あと<b>${d}</b>日</span>`;
}

export function card(x, today) {
  const { fair: f, next: n, last } = x;
  const state = n.state === 'expected' && n.running ? 'now' : n.state;
  const label = n.state === 'expected' && n.running ? '例年どおりなら開催中' : STATE_LABEL[n.state];
  const official = f.url
    ? `<a class="btn" href="${esc(f.url)}" target="_blank" rel="noopener">公式サイト</a>`
    : `<a class="btn btn--ghost" href="${esc(gsearch(f.name + ' 公式'))}" target="_blank" rel="noopener">公式をさがす</a>`;
  const src = n.source || f.source;
  return `<article class="card" data-state="${state}">
    <div class="card__head">
      <p class="card__when">${esc(whenText(n))}</p>
      <h3 class="card__name">${esc(f.name)}</h3>
      <div class="card__badges"><span class="pill pill--${n.state}${n.running ? ' pill--running' : ''}">${label}</span>${countdown(n, today)}</div>
    </div>
    <dl class="card__meta">
      <div><dt>焼き物</dt><dd>${esc(f.ware)}</dd></div>
      <div><dt>場所</dt><dd>${esc(f.pref)}・${esc(f.city)}</dd></div>
      ${f.ruleNote ? `<div><dt>例年</dt><dd>${esc(f.ruleNote.replace(/^例年/, ''))}${f.ruleStatus === '未確認' ? '<span class="unverified">未確認</span>' : ''}</dd></div>` : ''}
      ${last ? `<div><dt>前回</dt><dd>${last.start.slice(0, 4)}年 ${range(last.start, last.end)}${last.note && /^第/.test(last.note) ? `（${esc(last.note)}）` : ''}</dd></div>` : ''}
      ${n.note && !/^第/.test(n.note) ? `<div><dt>注意</dt><dd>${esc(n.note)}</dd></div>` : ''}
      ${f.note ? `<div><dt>メモ</dt><dd>${esc(f.note)}</dd></div>` : ''}
    </dl>
    <div class="card__links">
      ${official}
      <a class="btn btn--ghost" href="${esc(gmaps(f.name + ' ' + f.pref + f.city))}" target="_blank" rel="noopener">地図</a>
      ${src ? `<a class="btn btn--ghost" href="${esc(src)}" target="_blank" rel="noopener">出典</a>` : ''}
    </div>
  </article>`;
}

const grid = (list, today) => `<div class="grid">${list.map((x) => card(x, today)).join('')}</div>`;
const inRegion = (x, region) => region === 'すべて' || x.fair.region === region;

/** 今月から12か月ぶんの月ボタン */
export function monthStrip(items, today, selected) {
  let y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const out = [];
  for (let i = 0; i < 12; i++) {
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    const n = items.filter((x) => monthsOf(x.next).includes(ym)).length;
    out.push(`<button class="day" type="button" data-month="${ym}" ${ym === selected ? 'aria-current="date"' : ''} ${n ? '' : 'data-empty'} aria-label="${y}年${m}月 ${n}件">
      <span class="day__m">${i === 0 || m === 1 ? y : ''}</span><span class="day__d">${m}</span><span class="day__w">${n}件</span></button>`);
    if (++m > 12) { m = 1; y++; }
  }
  return out.join('');
}

export function regionChips(items, regions, region) {
  const count = (r) => items.filter((x) => x.fair.region === r).length;
  return ['すべて', ...regions.filter(count)].map((r) => `<button type="button" class="chip" data-region="${esc(r)}" aria-pressed="${r === region}">${esc(r)}${r === 'すべて' ? '' : `<span class="chip__n">${count(r)}</span>`}</button>`).join('');
}

/* ---------- 日程順 ---------- */
export function viewCalendar(items, today, { region, month }) {
  let list = items.filter((x) => inRegion(x, region));
  const n = (s) => list.filter((x) => x.next.state === s).length;
  const summary = `<div class="summary"><p>開催中 <b class="num">${n('now')}</b> ・ 日程発表済 <b class="num">${n('confirmed')}</b> ・ 例年どおりなら <b class="num">${n('expected')}</b> ・ 時期のみ <b class="num">${n('month')}</b></p>
    ${month ? `<button type="button" class="btn btn--ghost" data-month="">${Number(month.slice(5))}月だけ表示中 ✕</button>` : ''}</div>`;
  if (month) list = list.filter((x) => monthsOf(x.next).includes(month));
  if (!list.length) return summary + '<p class="empty">条件に合う陶器市がありません</p>';
  const groups = new Map();
  for (const x of list) { const ym = month || x.next.sortKey.slice(0, 7); if (!groups.has(ym)) groups.set(ym, []); groups.get(ym).push(x); }
  return summary + [...groups].map(([ym, xs]) => `<section class="month"><h2 class="month__title"><span class="month__y">${ym.slice(0, 4)}年</span>${Number(ym.slice(5))}月<span class="month__n">${xs.length}件</span></h2>${grid(xs, today)}</section>`).join('');
}

/* ---------- 産地別 ---------- */
export function viewRegion(items, today, { region }, regions) {
  const list = items.filter((x) => inRegion(x, region));
  return regions.filter((r) => list.some((x) => x.fair.region === r)).map((r) => {
    const xs = list.filter((x) => x.fair.region === r).sort((a, b) => a.fair.pref.localeCompare(b.fair.pref, 'ja') || a.next.sortKey.localeCompare(b.next.sortKey));
    return `<section class="month"><h2 class="month__title">${esc(r)}<span class="month__n">${xs.length}件</span></h2>${grid(xs, today)}</section>`;
  }).join('') || '<p class="empty">条件に合う陶器市がありません</p>';
}

/* ---------- はしご ---------- */
export function viewHashigo(items, today, { region }, groups) {
  const html = groups.map((g) => {
    const members = items.filter((x) => x.fair.hashigo === g.key);
    if (!members.length || !members.some((x) => inRegion(x, region))) return '';
    const sets = overlapSets(members);
    const used = new Set(sets.flatMap((s) => s.members.map((x) => x.fair.id)));
    const rest = members.filter((x) => !used.has(x.fair.id));
    const setsHtml = sets.map((s) => {
      const days = s.common ? diffDays(s.common.from, s.common.to) + 1 : 0;
      const label = s.common
        ? `${s.common.from.slice(0, 4)}年 ${range(s.common.from, s.common.to)}は${s.members.length}つとも開催（${days}日間）`
        : `${s.from.slice(0, 4)}年 ${range(s.from, s.to)}に続けて開催`;
      const maybe = rest.filter((x) => x.next.state === 'month' && monthsOf({ start: s.from, end: s.to }).includes(monthsOf(x.next)[0]));
      const guess = s.members.some((x) => x.next.state === 'expected') ? '<span class="unverified">例年どおりなら</span>' : '';
      return `<h3 class="combo__label">${label}${guess}</h3>${grid(s.members, today)}
        ${maybe.length ? `<p class="combo__note">同じころに開催（日程は未確認）：${maybe.map((x) => esc(x.fair.name)).join('、')}</p>` : ''}`;
    }).join('');
    return `<section class="combo">
      <header class="combo__head">
        <h2 class="combo__name">${esc(g.title)}</h2>
        ${g.note ? `<p class="combo__sub">${esc(g.note)}${g.source ? ` ・ <a href="${esc(g.source)}" target="_blank" rel="noopener">出典</a>` : ''}</p>` : ''}
      </header>
      ${setsHtml || '<p class="combo__note">次の開催で日程が重なる組み合わせは、まだ見つかっていません。</p>'}
      ${rest.length ? `<details class="combo__more"><summary>このエリアのほかの陶器市（${rest.length}）</summary>${grid(rest, today)}</details>` : ''}
    </section>`;
  }).join('');
  return `<p class="lead">近い産地で、同じ日に開かれる陶器市の組み合わせです。1回の旅行でまとめて回れます。</p>` + (html || '<p class="empty">この地方のはしごエリアはまだ登録していません</p>');
}
