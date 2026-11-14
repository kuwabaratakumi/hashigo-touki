# まわせ！はしご陶器市

全国の陶器市の日程をまとめて見て、同じ時期に回れる組み合わせを探すサイトです。はしごシネマ・ミュージアム・寄席・キャンプと同じ作りです。

- **日程順** … これから開かれる陶器市を、月ごとに近い順で並べます
- **産地別** … 地方ごとの一覧
- **はしご** … 近い産地で日程が重なる陶器市の組み合わせ（益子＋笠間、有田＋波佐見 など）

## 仕組み

```
data/fairs.csv（陶器市の一覧と例年の決まり）─┐
data/dates.csv（発表された日程）────────────┼─ scripts/build.mjs ─> public/data/fairs.json ─> public/（静的サイト）
data/hashigo.csv（はしごエリアの説明）──────┘
```

- 「次の開催」は **閲覧したときにブラウザで計算** します（`public/schedule.js`）。陶器市のサイトへは自動でアクセスしません
- GitHub Actions が毎週月曜 5:20（日本時間）と、main への push のたびに作り直して Cloudflare Pages の `hashigo-touki` に公開します

## 日程の表示（4種類）

| 表示 | 意味 | もとになるデータ |
|---|---|---|
| 開催中 | 今日が期間内 | dates.csv（なければ例年の決まり） |
| 日程発表済 | これからの日程を確認できた | dates.csv |
| 例年どおりなら | 例年の決まりから計算した目安 | fairs.csv の rule |
| 時期のみ | 月（と上旬・中旬・下旬）だけわかる | fairs.csv の rule |

## 毎年の更新（これだけ）

その年の日程が発表されたら、`data/dates.csv` に1行足して push します。

```
t007,2027-04-29,2027-05-05,第115回,https://（確認したページ）
```

終了日がまだわからないときは `end` を空にします（画面は「11/27〜」と出ます）。

## 陶器市データ（data/fairs.csv）

| 列 | 内容 |
|---|---|
| `id` | t001 のような固定ID（変えない） |
| `ware` / `pref` / `city` | 焼き物の名前・都道府県・市町村 |
| `region` | 北海道・東北／関東／北陸・甲信越／東海／近畿／中国・四国／九州・沖縄 |
| `rule_type` | 例年の決まりの型（下の表） |
| `rule_note` | 画面にそのまま出す説明（例「毎年4月29日〜5月5日」） |
| `rule_status` | 確認済（公式・観光協会の案内）／推定（情報サイトや過去の日程から）／未確認（まだ調べていない）／掲載中止 |
| `official_url` | 確認できた公式サイト。空なら画面は「公式をさがす」（検索リンク）になる |
| `hashigo` | はしごエリアのキー（hashigo.csv の `key`）。なければ空 |
| `source` | 確認元のURL |

| `rule_type` | `rule_a` | `rule_b` | `rule_offset` | `rule_days` | 例 |
|---|---|---|---|---|---|
| `fixed` | 開始 MM-DD | 終了 MM-DD | | | 有田陶器市（04-29 / 05-05） |
| `nth` | 月-第n-曜日（0=日〜6=土） | | 基準日から何日ずらすか | 何日間か | 備前焼まつり（10-3-0 / -1 / 2 ＝ 10月第3日曜の前日から2日間） |
| `month` | 月 | 上旬・中旬・下旬（空でもよい） | | | 壺屋陶器まつり（11 / 下旬） |

`node scripts/build.mjs` が書式の間違いを見つけたら止まります。

## いまのデータの状態（2026-11-14）

- 47件。うち「確認済」7件、「推定」39件、「未確認」1件
- `official_url` が入っているのは20件。残りは「公式をさがす」リンクです
- 日程の確認元は情報サイト・観光協会のページが中心です。主催者の公式発表で確かめられたら `source` を差し替えます

## ローカルで動かす

```bash
npm run build        # CSV → public/data/fairs.json
npm test             # 開催日の計算テスト
npm run serve        # http://localhost:8080
```

## 公開（Cloudflare Pages）初回の設定

1. GitHub に `hashigo-touki` リポジトリを作って push
2. Settings → Secrets and variables → Actions に `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` を登録（ほかのはしごサイトと同じもの）
3. Actions タブで「データ更新・公開」を手動実行 → `https://hashigo-touki.pages.dev`
4. `touki.hashigo-map.com` を Pages に接続し、pages.dev は Cloudflare Access（はしごシリーズ共通の設定）で自分だけに

## 掲載中止のご依頼があったとき

`data/fairs.csv` の該当行の `rule_status` を `掲載中止` に変えて push します（行を残すのは、あとで足し直さないようにするため）。情報の集め方は `docs/terms.md`。
