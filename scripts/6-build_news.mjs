// Builds data/news.json (public RSS headlines) and data/markets.json (index / FX / commodity snapshot).
// Runs in the same 6-hourly GitHub Action as build_data.mjs. Headlines are links to the publisher, nothing is rewritten.
import fs from 'node:fs';
const out = f => new URL('../data/' + f, import.meta.url);
const FEEDS = [
  { src: 'BBC News', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', region: 'World' },
  { src: 'CNBC', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html', region: 'US' },
  { src: 'CNBC Markets', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', region: 'US' },
  { src: 'Economic Times', url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms', region: 'India' },
  { src: 'Mint', url: 'https://www.livemint.com/rss/markets', region: 'India' },
];
const dec = s => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').trim();
const tag = (x, t) => dec((x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1]);
const names = JSON.parse(fs.readFileSync(out('companies.json'))).companies.map(c => ({ id: c.id, name: c.name, re: new RegExp('\\b' + c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\.').replace(/ (Inc|Corp|Ltd|Limited|Industries|Company)\.?$/i, '') + '\\b') }));
const items = [];
for (const f of FEEDS) {
  try {
    const r = await fetch(f.url, { headers: { 'User-Agent': 'Mozilla/5.0 CompanyXRay' } });
    if (!r.ok) throw new Error(r.status);
    const xml = await r.text();
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const x = m[1], title = tag(x, 'title'), link = tag(x, 'link') || (x.match(/<link>([^<]+)/) || [])[1];
      const t = Date.parse(tag(x, 'pubDate')); if (!title || !link || !t) continue;
      const img = (x.match(/<media:(?:thumbnail|content)[^>]*url="([^"]+)"/) || x.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/) || [])[1] || null;
      const tags = names.filter(n => n.re.test(title)).map(n => n.id).slice(0, 3);
      items.push({ title, link, src: f.src, region: f.region, time: new Date(t).toISOString(), img, summary: tag(x, 'description').slice(0, 220), tags });
    }
    console.log('NEWS ok', f.src);
  } catch (e) { console.log('NEWS fail', f.src, e.message); }
}
const seen = new Set(), uniq = items.sort((a, b) => b.time.localeCompare(a.time)).filter(i => { const k = i.title.toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; });
if (uniq.length > 10) fs.writeFileSync(out('news.json'), JSON.stringify({ generated: new Date().toISOString(), items: uniq.slice(0, 80) }, null, 1));
else console.log('NEWS kept old file, only', uniq.length, 'items');

const MK = [['S&P 500', '^GSPC'], ['Nasdaq', '^IXIC'], ['Dow', '^DJI'], ['Nifty 50', '^NSEI'], ['Sensex', '^BSESN'], ['FTSE 100', '^FTSE'], ['Nikkei 225', '^N225'], ['USD/INR', 'INR=X'], ['Gold', 'GC=F'], ['Brent', 'BZ=F'], ['US 10Y', '^TNX'], ['Bitcoin', 'BTC-USD']];
const prev = fs.existsSync(out('markets.json')) ? JSON.parse(fs.readFileSync(out('markets.json'))) : { items: [] };
const res = [];
for (const [name, sym] of MK) {
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const j = (await r.json()).chart.result[0], m = j.meta, cl = (j.indicators.quote[0].close || []).filter(v => v != null);
    const last = cl.at(-1), prev = Math.abs(last - m.regularMarketPrice) < 1e-6 * Math.max(1, Math.abs(last)) ? cl.at(-2) : last;
    res.push({ name, sym, price: m.regularMarketPrice, prev, time: m.regularMarketTime });
  } catch (e) { const o = prev.items.find(i => i.sym === sym); if (o) res.push(o); console.log('MKT fail', sym, e.message); }
}
if (res.length) fs.writeFileSync(out('markets.json'), JSON.stringify({ generated: new Date().toISOString(), items: res }));
