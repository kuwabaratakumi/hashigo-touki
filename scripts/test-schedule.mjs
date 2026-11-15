// 開催日の計算テスト：node scripts/test-schedule.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { nthWeekday, occurrence, nextOccurrence, lastHeld, monthsOf, overlapSets } from '../public/schedule.js';
import { enrich, viewCalendar, viewRegion, viewHashigo, monthStrip, regionChips, setFavs } from '../public/views.js';

// 第n◇曜
assert.equal(nthWeekday(2026, 11, 2, 6), 14);            // 2026年11月 第2土曜
assert.equal(nthWeekday(2026, 12, 3, 5), 18);            // 2026年12月 第3金曜
const bizen = { type: 'nth', month: 10, n: 3, weekday: 0, offset: -1, days: 2 };
assert.deepEqual(occurrence(bizen, 2026), { start: '2026-10-17', end: '2026-10-18' });   // 第3日曜とその前日
const koishi = { type: 'nth', month: 10, n: 2, weekday: 1, offset: -2, days: 3 };
assert.deepEqual(occurrence(koishi, 2025), { start: '2025-10-11', end: '2025-10-13' });  // スポーツの日の3連休（2025年の実績と一致）
assert.deepEqual(occurrence({ type: 'nth', month: 9, n: 2, weekday: 6, days: 2 }, 2026), { start: '2026-09-12', end: '2026-09-13' }); // せともの祭 2026 の実績
assert.deepEqual(occurrence({ type: 'nth', month: 4, n: 3, weekday: 6, days: 2 }, 2025), { start: '2025-04-19', end: '2025-04-20' }); // 砥部焼まつり 2025 の実績

// 次の開催
const gw = { rule: { type: 'fixed', start: '04-29', end: '05-05' }, dates: [{ start: '2026-04-29', end: '2026-05-05' }] };
assert.equal(nextOccurrence(gw, '2026-11-14').start, '2027-04-29');
assert.equal(nextOccurrence(gw, '2026-11-14').state, 'expected');
assert.equal(nextOccurrence(gw, '2026-05-01').state, 'now');
assert.equal(lastHeld(gw, '2026-11-14').start, '2026-04-29');
const noEnd = { rule: { type: 'month', month: 11, part: '下旬' }, dates: [{ start: '2026-11-27' }] };
assert.equal(nextOccurrence(noEnd, '2026-11-14').state, 'confirmed');
assert.equal(nextOccurrence(noEnd, '2026-11-28').state, 'now');
assert.equal(nextOccurrence(noEnd, '2026-12-05').year, 2027);       // 今年分は終了 → 来年
const early = { rule: { type: 'month', month: 11, part: '上旬' }, dates: [] };
assert.equal(nextOccurrence(early, '2026-11-14').year, 2027);       // 上旬は過ぎた
assert.equal(nextOccurrence(early, '2026-11-05').year, 2026);
const newYear = { rule: { type: 'fixed', start: '01-02', end: '01-05' }, dates: [{ start: '2026-01-02', end: '2026-01-05' }] };
assert.equal(nextOccurrence(newYear, '2026-11-14').start, '2027-01-02');
assert.deepEqual(monthsOf({ start: '2027-04-29', end: '2027-05-05' }), ['2027-04', '2027-05']);

// はしご
const A = { next: { start: '2027-04-29', end: '2027-05-05' } }, B = { next: { start: '2027-05-02', end: '2027-05-05' } }, C = { next: { start: '2027-10-10', end: '2027-10-11' } };
const sets = overlapSets([A, B, C]);
assert.equal(sets.length, 1);
assert.deepEqual(sets[0].common, { from: '2027-05-02', to: '2027-05-05' });

// 実データで全画面を描いてみる（build 済みのとき）
try {
  const d = JSON.parse(await fs.readFile(new URL('../public/data/fairs.json', import.meta.url), 'utf8'));
  for (const today of ['2026-11-14', '2027-01-03', '2027-04-30', '2027-10-12']) {
    const items = enrich(d.fairs, today);
    const st = { region: 'すべて', month: '' };
    for (const html of [viewCalendar(items, today, st), viewRegion(items, today, st, d.regions), viewHashigo(items, today, st, d.groups), monthStrip(items, today, ''), regionChips(items, d.regions, 'すべて')]) {
      assert.ok(html.length > 100 && !html.includes('undefined') && !html.includes('NaN'), '画面に undefined / NaN が出ている');
    }
  }
  console.log(`実データ ${d.fairs.length}件で全画面の描画OK`);

  // お気に入り：ハートが押された状態で描かれるのは登録した1件だけ
  const items = enrich(d.fairs, '2026-11-14'), st = { region: 'すべて', month: '' };
  setFavs(new Set([d.fairs[0].id]));
  const on = (viewCalendar(items, '2026-11-14', st).match(/class="fav" data-fav="[^"]+" aria-pressed="true"/g) || []).length;
  assert.equal(on, 1);
  setFavs(new Set());
  assert.equal((viewCalendar(items, '2026-11-14', st).match(/class="fav" data-fav="[^"]+" aria-pressed="true"/g) || []).length, 0);
  // 絞り込んで0件になった地方でも、選択中のチップは消えない
  assert.ok(regionChips([], d.regions, d.regions[0]).includes(`data-region="${d.regions[0]}"`));
  console.log('お気に入り・地方チップのテスト OK');
} catch (e) { if (e.code !== 'ENOENT') throw e; console.log('public/data がないので描画テストは省略（先に npm run build）'); }
console.log('開催日の計算テスト OK');
