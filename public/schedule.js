// 陶器市の「次の開催」を計算する。日付はすべて 'YYYY-MM-DD'（日本時間）。
//   rule.type = fixed … 毎年同じ日付（start/end は 'MM-DD'）
//               nth   … ○月の第n◇曜を基準に offset 日ずらして days 日間
//               month … 月（と上旬・中旬・下旬）しかわからない
// data/dates.csv に発表済みの日程があれば、そちらを優先する。
const pad = (n) => String(n).padStart(2, '0');
const DAY = 86400000;
const t = (iso) => Date.parse(iso + 'T00:00:00Z');
export const addDays = (iso, n) => new Date(t(iso) + n * DAY).toISOString().slice(0, 10);
export const diffDays = (a, b) => Math.round((t(b) - t(a)) / DAY);
export const jstToday = (now = new Date()) => new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);

/** y年m月の第n w曜（w: 0=日 … 6=土）の日 */
export function nthWeekday(y, m, n, w) {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return 1 + ((w - first + 7) % 7) + (n - 1) * 7;
}

/** ルールから y年の開催日を出す（month 型は null） */
export function occurrence(rule, y) {
  if (rule.type === 'fixed') {
    const start = `${y}-${rule.start}`;
    const end = rule.end < rule.start ? `${y + 1}-${rule.end}` : `${y}-${rule.end}`;
    return { start, end };
  }
  if (rule.type === 'nth') {
    const base = `${y}-${pad(rule.month)}-${pad(nthWeekday(y, rule.month, rule.n, rule.weekday))}`;
    const start = addDays(base, rule.offset || 0);
    return { start, end: addDays(start, (rule.days || 1) - 1) };
  }
  return null;
}

const PART_END = { 上旬: 10, 中旬: 20, 下旬: 31 };
const PART_KEY = { 上旬: '05', 中旬: '15', 下旬: '25' };
// 終了日がわからない日程は、開始から3日間だけ「開催中」として扱う
const liveEnd = (d) => d.end || addDays(d.start, 2);

/**
 * 次の開催。state は
 *   now … 開催中 / confirmed … 日程発表済 / expected … 例年どおりなら / month … 時期のみ
 */
export function nextOccurrence(fair, today) {
  const dates = [...(fair.dates || [])].sort((a, b) => a.start.localeCompare(b.start));
  const live = dates.find((d) => liveEnd(d) >= today);
  if (live) {
    return { state: live.start <= today ? 'now' : 'confirmed', start: live.start, end: live.end || '', sortKey: live.start, source: live.source, note: live.note };
  }
  const y0 = Number(today.slice(0, 4));
  const doneYears = new Set(dates.map((d) => d.start.slice(0, 4)));
  const r = fair.rule;
  if (r.type === 'fixed' || r.type === 'nth') {
    for (const y of [y0 - 1, y0, y0 + 1, y0 + 2]) {
      const o = occurrence(r, y);
      if (o.end < today || doneYears.has(o.start.slice(0, 4))) continue;
      return { state: 'expected', running: o.start <= today, ...o, sortKey: o.start };
    }
  }
  if (r.type === 'month') {
    const m0 = Number(today.slice(5, 7)), d0 = Number(today.slice(8, 10));
    const passed = r.month < m0 || (r.month === m0 && r.part && d0 > PART_END[r.part]) || doneYears.has(String(y0));
    const y = passed ? y0 + 1 : y0;
    return { state: 'month', year: y, month: r.month, part: r.part || '', sortKey: `${y}-${pad(r.month)}-${PART_KEY[r.part] || '28'}` };
  }
  return { state: 'unknown', sortKey: '9999-12-31' };
}

/** いちばん最近の、確認できている開催 */
export function lastHeld(fair, today) {
  return [...(fair.dates || [])].filter((d) => liveEnd(d) < today).sort((a, b) => b.start.localeCompare(a.start))[0] || null;
}

/** その開催がかかる月（'YYYY-MM' の配列） */
export function monthsOf(n) {
  if (n.state === 'month') return [`${n.year}-${pad(n.month)}`];
  if (!n.start) return [];
  const out = []; const last = (n.end || n.start).slice(0, 7);
  let y = Number(n.start.slice(0, 4)), m = Number(n.start.slice(5, 7));
  for (let i = 0; i < 12; i++) {
    const ym = `${y}-${pad(m)}`; out.push(ym);
    if (ym >= last) break;
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

/**
 * はしご：同じエリア（hashigo が同じ）で、次の開催の日程が重なるものを組にする。
 * 戻り値: [{ members:[{fair,next}], from, to, common }]（2件以上の組だけ）
 */
export function overlapSets(items) {
  const dated = items.filter((x) => x.next.start).sort((a, b) => a.next.start.localeCompare(b.next.start));
  const sets = []; let cur = null;
  for (const x of dated) {
    const s = x.next.start, e = x.next.end || x.next.start;
    if (cur && s <= cur.to) { cur.members.push(x); if (e > cur.to) cur.to = e; if (s > cur.cFrom) cur.cFrom = s; if (e < cur.cTo) cur.cTo = e; }
    else { cur = { members: [x], from: s, to: e, cFrom: s, cTo: e }; sets.push(cur); }
  }
  return sets.filter((c) => c.members.length > 1).map((c) => ({ members: c.members, from: c.from, to: c.to, common: c.cFrom <= c.cTo ? { from: c.cFrom, to: c.cTo } : null }));
}
