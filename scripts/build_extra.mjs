// Adds "total revenue only" companies (S&P 500 names with no tagged product/segment split in our config).
// Real data only: annual total revenue from the company's own 10-K (SEC EDGAR XBRL companyfacts) + Yahoo prices.
// A company is skipped, never estimated, if either year of revenue is missing.
// Run after build_data.mjs: node scripts/build_extra.mjs   (env LIMIT=n for a test run)
import fs from 'node:fs';
const UA = 'CompanyXRay learning project its.kanishk.saini@gmail.com';
const YUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rd = f => JSON.parse(fs.readFileSync(new URL('../data/' + f, import.meta.url)));
const list = JSON.parse(fs.readFileSync(new URL('./extra_list.json', import.meta.url)));
const co = rd('companies.json'), pr = rd('prices.json');
const prevExtra = new Map(co.companies.filter(c => c.totalOnly).map(c => [c.id, c]));
const base = co.companies.filter(c => !c.totalOnly), have = new Set(base.map(c => c.id));
const tick = await (await fetch('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': UA } })).json();
const cik = {}; for (const v of Object.values(tick)) cik[v.ticker.toUpperCase()] = String(v.cik_str).padStart(10, '0');
const CONCEPTS = ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet', 'SalesRevenueServicesNet', 'InterestAndDividendIncomeOperating'];
const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;
function annual(facts) {
  let best = null;
  for (const k of CONCEPTS) {
    const u = facts?.['us-gaap']?.[k]?.units?.USD; if (!u) continue;
    const byEnd = new Map();
    for (const e of u) { if (e.fp !== 'FY' || !/^10-K/.test(e.form) || !e.start) continue; const d = days(e.start, e.end); if (d < 350 || d > 380) continue; const p = byEnd.get(e.end); if (!p || e.filed > p.filed) byEnd.set(e.end, e); }
    const ends = [...byEnd.keys()].sort(); if (ends.length < 2) continue;
    const cur = byEnd.get(ends.at(-1)), prev = byEnd.get(ends.at(-2));
    if (days(prev.end, cur.end) < 350 || days(prev.end, cur.end) > 380 || !(cur.val > 0) || !(prev.val > 0)) continue;
    if (!best || cur.end > best.cur.end) best = { cur, prev, concept: k };
  }
  return best;
}
const out = []; let n = 0;
for (const [id, name, sector] of list) {
  if (have.has(id)) continue; if (process.env.LIMIT && n >= +process.env.LIMIT) break; n++;
  try {
    const c10 = cik[id.toUpperCase()]; if (!c10) throw new Error('no CIK');
    const r = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${c10}.json`, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error('SEC ' + r.status);
    const j = await r.json(); const a = annual(j.facts); if (!a) throw new Error('no two comparable annual revenue values');
    const y = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(id)}?range=1y&interval=1d`, { headers: { 'User-Agent': YUA } });
    if (!y.ok) throw new Error('Yahoo ' + y.status);
    const jj = (await y.json()).chart.result[0], m = jj.meta, q = jj.indicators.quote[0];
    const pts = jj.timestamp.map((t, i) => [t, q.close[i]]).filter(p => p[1] != null).map(p => [p[0], +p[1].toFixed(2)]);
    if (pts.length < 20) throw new Error('too little price history');
    const cur = Math.round(a.cur.val / 1e6), prev = Math.round(a.prev.val / 1e6);
    out.push({ co: { id, name, market: 'US', exchange: /nasdaq/i.test(m.fullExchangeName) ? 'Nasdaq' : /nyse/i.test(m.fullExchangeName) ? 'NYSE' : m.fullExchangeName, currency: 'USD', unit: 'USD million', period: `Fiscal year ended ${a.cur.end}, total revenue only (no product or segment split)`, periodType: 'year', source: `${j.entityName} Form 10-K (SEC EDGAR)`, sourceUrl: `https://www.sec.gov/Archives/edgar/data/${+c10}/${a.cur.accn.replace(/-/g, '')}/`, filed: a.cur.filed, note: `Total revenue only: this company's tagged segment split was not added, so there is no weak-spot ranking or acquisition pitch. Figure is the 10-K "${a.concept}" value for two consecutive fiscal years, read automatically from SEC EDGAR. Sector: ${sector}.`, totalOnly: true, symbol: id, segments: [{ name: 'Total revenue', cur, prev, growth: +((cur / prev - 1) * 100).toFixed(1) }] },
      px: { symbol: id, currency: m.currency, price: m.regularMarketPrice, time: m.regularMarketTime, prevClose: m.chartPreviousClose, hi52: m.fiftyTwoWeekHigh, lo52: m.fiftyTwoWeekLow, exchange: m.fullExchangeName, pts } });
    console.log('ok', id, cur, prev);
  } catch (e) { const old = prevExtra.get(id); if (old && pr.series[id]) { out.push({ co: old, px: pr.series[id] }); console.log('KEEP', id, e.message); } else console.log('SKIP', id, e.message); }
  await sleep(250);
}
for (const k of Object.keys(pr.series)) if (prevExtra.has(k)) delete pr.series[k];
for (const o of out) pr.series[o.co.id] = o.px;
pr.generated = new Date().toISOString();
fs.writeFileSync(new URL('../data/companies.json', import.meta.url), JSON.stringify({ generated: new Date().toISOString(), companies: [...base, ...out.map(o => o.co)] }, null, 1));
fs.writeFileSync(new URL('../data/prices.json', import.meta.url), JSON.stringify(pr));
console.log('extras written:', out.length);
