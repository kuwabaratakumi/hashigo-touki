// data/*.csv（編集用）→ public/data/fairs.json（公開用）
//   node scripts/build.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const REGIONS = ['北海道・東北', '関東', '北陸・甲信越', '東海', '近畿', '中国・四国', '九州・沖縄'];
const STATUS = new Set(['確認済', '推定', '未確認', '掲載中止']);
const PARTS = new Set(['', '上旬', '中旬', '下旬']);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MD = /^\d{2}-\d{2}$/;

/** ダブルクォート・改行入りにも対応する最小限のCSV読み込み */
export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((v) => v !== ''));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.replace(/^﻿/, ''), (r[i] ?? '').trim()])));
}

const read = async (f) => parseCsv(await fs.readFile(path.join(root, 'data', f), 'utf8'));

function toRule(f, errors) {
  const bad = (msg) => errors.push(`${f.id} ${f.name}: ${msg}`);
  if (f.rule_type === 'fixed') {
    if (!MD.test(f.rule_a) || !MD.test(f.rule_b)) bad('fixed は rule_a・rule_b に MM-DD');
    return { type: 'fixed', start: f.rule_a, end: f.rule_b };
  }
  if (f.rule_type === 'nth') {
    const m = /^(\d{1,2})-([1-5])-([0-6])$/.exec(f.rule_a);
    if (!m) { bad('nth は rule_a に「月-第n-曜日(0=日〜6=土)」'); return { type: 'month', month: 1 }; }
    if (!(Number(f.rule_days) > 0)) bad('nth は rule_days（日数）が必要');
    return { type: 'nth', month: Number(m[1]), n: Number(m[2]), weekday: Number(m[3]), offset: Number(f.rule_offset || 0), days: Number(f.rule_days) };
  }
  if (f.rule_type === 'month') {
    const month = Number(f.rule_a);
    if (!(month >= 1 && month <= 12)) bad('month は rule_a に月（1〜12）');
    if (!PARTS.has(f.rule_b)) bad('month の rule_b は 上旬／中旬／下旬 か空');
    return { type: 'month', month, ...(f.rule_b && { part: f.rule_b }) };
  }
  bad(`rule_type が不正 (${f.rule_type})`);
  return { type: 'month', month: 1 };
}

async function main() {
  const errors = [];
  const [fairs, dates, groups] = await Promise.all([read('fairs.csv'), read('dates.csv'), read('hashigo.csv')]);
  const ids = new Set(); const keys = new Set(groups.map((g) => g.key));
  for (const f of fairs) {
    if (ids.has(f.id)) errors.push(`id が重複: ${f.id}`);
    ids.add(f.id);
    if (!REGIONS.includes(f.region)) errors.push(`${f.id} ${f.name}: region が不正 (${f.region})`);
    if (!STATUS.has(f.rule_status)) errors.push(`${f.id} ${f.name}: rule_status が不正 (${f.rule_status})`);
    if (f.hashigo && !keys.has(f.hashigo)) errors.push(`${f.id} ${f.name}: hashigo「${f.hashigo}」が hashigo.csv にない`);
    if (f.official_url && !/^https:\/\//.test(f.official_url)) errors.push(`${f.id} ${f.name}: official_url は https:// から`);
  }
  const byId = {};
  for (const d of dates) {
    if (!ids.has(d.id)) errors.push(`dates.csv: ${d.id} が fairs.csv にない`);
    if (!ISO.test(d.start) || (d.end && !ISO.test(d.end))) errors.push(`dates.csv: ${d.id} の日付は YYYY-MM-DD`);
    if (d.end && d.end < d.start) errors.push(`dates.csv: ${d.id} の end が start より前`);
    (byId[d.id] ??= []).push({ start: d.start, ...(d.end && { end: d.end }), ...(d.note && { note: d.note }), ...(d.source && { source: d.source }) });
  }
  const out = fairs.filter((f) => f.rule_status !== '掲載中止').map((f) => ({
    id: f.id, name: f.name, ware: f.ware, pref: f.pref, city: f.city, region: f.region,
    rule: toRule(f, errors), ruleNote: f.rule_note, ruleStatus: f.rule_status,
    url: f.official_url, hashigo: f.hashigo, note: f.note, source: f.source,
    dates: byId[f.id] || [],
  }));
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

  const dir = path.join(root, 'public', 'data');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'fairs.json'), JSON.stringify({ builtAt: new Date().toISOString(), regions: REGIONS, fairs: out, groups }));
  const n = (t) => out.filter((f) => f.rule.type === t).length;
  console.log(`陶器市 ${out.length}件（毎年同じ日 ${n('fixed')}／第n◇曜 ${n('nth')}／時期のみ ${n('month')}）・発表済みの日程 ${dates.length}件・はしごエリア ${groups.length}件`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
