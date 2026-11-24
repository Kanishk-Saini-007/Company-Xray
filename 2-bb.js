// Front page: ticker, news, weak-spot screener. Reads data/news.json and data/markets.json (rebuilt every 6 hours).
const bb = { news: [], markets: [], tab: 'All' };
const ago = iso => { const m = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
const nfmt = (v, n) => v == null ? '-' : v.toLocaleString('en-US', { minimumFractionDigits: n, maximumFractionDigits: n });
function renderTicker() {
  const row = document.getElementById('tkRow'); if (!row) return;
  row.innerHTML = bb.markets.map(m => {
    const ch = m.prev ? (m.price / m.prev - 1) * 100 : null, up = ch >= 0;
    const d = /Bitcoin|Nifty|Sensex|S&P|Nasdaq|Dow|FTSE|Nikkei/.test(m.name) ? 2 : 2;
    return `<span class="tk ${up ? 'up' : 'dn'}"><b>${m.name}</b> ${nfmt(m.price, d)} <i>${up ? '&#9650;' : '&#9660;'} ${ch == null ? '' : Math.abs(ch).toFixed(2) + '%'}</i></span>`;
  }).join('');
  const g = bb.marketsAt; document.getElementById('tkNote').textContent = g ? 'Latest saved quotes, ' + new Date(g).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
}
function newsCard(n, big) {
  const tags = (n.tags || []).map(t => `<a class="bb-tag" data-id="${t}">${t}</a>`).join('');
  return `<article class="bb-story${big ? ' big' : ''}">${big && n.img ? `<a href="${n.link}" target="_blank" rel="noopener"><img src="${n.img}" alt="" loading="lazy" onerror="this.remove()"></a>` : ''}${big ? '<div class="bb-kick">Top story</div>' : ''}<h3><a href="${n.link}" target="_blank" rel="noopener">${esc(n.title)}</a></h3>${big && n.summary ? `<p>${esc(n.summary)}</p>` : ''}<div class="bb-meta"><span>${esc(n.src)}</span><span>${ago(n.time)}</span>${tags}</div></article>`;
}
function renderNews() {
  if (!document.getElementById('newsGrid')) return;
  const withImg = null;
  const tabs = ['All', 'US', 'India', 'World', 'Our companies'];
  document.getElementById('newsTabs').innerHTML = tabs.map(t => `<button class="${bb.tab === t ? 'on' : ''}" data-nt="${t}">${t}</button>`).join('');
  let list = bb.news.filter(n => n !== withImg);
  if (bb.tab === 'Our companies') list = list.filter(n => n.tags?.length); else if (bb.tab !== 'All') list = list.filter(n => n.region === bb.tab);
  document.getElementById('newsGrid').innerHTML = list.slice(0, 12).map(n => newsCard(n, false)).join('') || '<p class="err">Nothing in this tab right now.</p>';
}
function renderScreener() {
  const mid = document.getElementById('bbMid'); if (!mid) return;
  const rows = state.companies.map(c => { const a = analyse(c); return a.weak && a.avg != null ? { c, a } : null; }).filter(Boolean).sort((x, y) => x.a.weak.growth - y.a.weak.growth).slice(0, 9);
  mid.innerHTML = `<h3 class="bb-h">Weak-spot screener <small>slowest segment (3%+ of revenue) across ${state.companies.length} companies</small></h3><table class="bb-tbl"><thead><tr><th>Company</th><th>Weakest segment</th><th class="r">Growth</th><th class="r">Share</th></tr></thead><tbody>${rows.map(({ c, a }) => `<tr data-id="${c.id}"><td><b>${esc(c.name)}</b><small>${esc(c.id)}</small></td><td>${esc(a.weak.name)}</td><td class="r dn">${pct(a.weak.growth)}</td><td class="r">${a.weak.share.toFixed(0)}%</td></tr>`).join('')}</tbody></table><p class="bb-fine">Click a row to open the segment ladder and the acquisition pitch. Reported figures only, periods differ by company.</p>`;
}
function renderRight() {
  return;
  const mv = document.getElementById('bbMovers'); if (!mv) return;
  mv.innerHTML = movers().map(({ c, l, chg }) => `<div class="bb-row" data-id="${c.id}"><span><b>${esc(c.name)}</b><small>${esc(c.id)}</small></span><span class="r">${px(l.price, c.currency)}<i class="${chg >= 0 ? 'up' : 'dn'}">${chg >= 0 ? '&#9650;' : '&#9660;'} ${Math.abs(chg).toFixed(2)}%</i></span></div>`).join('');
  document.getElementById('bbMarkets').innerHTML = bb.markets.filter(m => /Gold|Brent|USD|10Y|Bitcoin/.test(m.name)).map(m => { const ch = m.prev ? (m.price / m.prev - 1) * 100 : 0; return `<div class="bb-row"><span><b>${m.name}</b></span><span class="r">${nfmt(m.price, 2)}<i class="${ch >= 0 ? 'up' : 'dn'}">${ch >= 0 ? '&#9650;' : '&#9660;'} ${Math.abs(ch).toFixed(2)}%</i></span></div>`; }).join('');
}
function renderCompanyNews() {
  const c = cur && cur(); if (!c) return;
  let el = document.getElementById('newsCard');
  if (!el) { el = document.createElement('div'); el.id = 'newsCard'; el.className = 'card span2'; const h = document.getElementById('honest'); h.parentNode.insertBefore(el, h); }
  const hits = bb.news.filter(n => n.tags?.includes(c.id)).slice(0, 5);
  el.innerHTML = `<h2>In the news: ${esc(c.name)}</h2><p class="sub">Headlines from BBC, CNBC, Economic Times and Mint that name the company. Links open the publisher.</p>` + (hits.length ? hits.map(n => `<p class="nw"><a href="${n.link}" target="_blank" rel="noopener">${esc(n.title)}</a> <small>${esc(n.src)} &middot; ${ago(n.time)}</small></p>`).join('') : '<p class="sub">No headline in the latest feed names this company.</p>');
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-nt]'); if (t) { bb.tab = t.dataset.nt; renderNews(); return; }
  const n = e.target.closest('[data-nav]'); if (n) { state.market = n.dataset.nav === 'all' ? 'All' : n.dataset.nav; renderTabs(); renderList(); document.getElementById('companyHead').scrollIntoView({ behavior: 'smooth' }); return; }
  const r = e.target.closest('tr[data-id],.bb-row[data-id],.bb-tag[data-id]');
  if (r) { state.id = r.dataset.id; location.hash = state.id; renderAll(); refreshLive(state.id); document.getElementById('companyHead').scrollIntoView({ behavior: 'smooth' }); }
});
(async function () {
  document.getElementById('bbDate').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const [nw, mk] = await Promise.all([fetch('data/news.json').then(r => r.json()).catch(() => ({ items: [] })), fetch('data/markets.json').then(r => r.json()).catch(() => ({ items: [] }))]);
  bb.news = nw.items; bb.markets = mk.items; bb.marketsAt = mk.generated;
  for (let i = 0; i < 100 && !state.companies.length; i++) await new Promise(r => setTimeout(r, 100));
  renderTicker(); renderNews(); renderScreener(); renderCompanyNews();
  const ra = renderAll; window.renderAll = function () { ra(); renderCompanyNews(); };
})();

(function () {
  const btn = document.getElementById('themeBtn'); if (!btn) return;
  const paint = () => { const d = document.documentElement.dataset.theme === 'dark'; btn.textContent = d ? 'Light mode' : 'Dark mode'; };
  btn.addEventListener('click', () => { const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; localStorage.setItem('xray_theme', n); paint(); });
  paint();
})();
