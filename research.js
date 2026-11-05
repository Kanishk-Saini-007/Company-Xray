'use strict';
// Filing comparison arithmetic, with missing values kept distinct from zero.
function compareSegments(segments) {
  const rows = segments.map(s => {
    const current = Number.isFinite(s.cur) ? s.cur : null;
    const prior = Number.isFinite(s.prev) ? s.prev : null;
    const delta = current !== null && prior !== null ? current - prior : null;
    return { name: s.name, current, prior, delta,
      growth: delta !== null && prior !== 0 ? delta / Math.abs(prior) * 100 : null };
  });
  const comparable = rows.filter(s => s.delta !== null);
  const current = comparable.reduce((v, s) => v + s.current, 0);
  const prior = comparable.reduce((v, s) => v + s.prior, 0);
  const delta = current - prior;
  return { rows, current, prior, delta, comparable: comparable.length,
    missing: rows.length - comparable.length,
    growth: prior !== 0 && comparable.length ? delta / Math.abs(prior) * 100 : null };
}
if (typeof module !== 'undefined') module.exports = { compareSegments };

function renderResearch(c) {
  const el = document.querySelector('#researchCard');
  if (!el || !c) return;
  const h = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const number = v => v === null ? 'Not available' : v.toLocaleString('en-US', { maximumFractionDigits: 1 });
  const change = v => v === null ? 'Not available' : (v > 0 ? '+' : '') + number(v);
  const result = compareSegments(c.segments);
  const sorted = [...result.rows].sort((a,b) => (b.delta ?? -Infinity) - (a.delta ?? -Infinity));
  const key = 'xray_research_v1_' + c.id;
  let note = {}, unavailable = false;
  try { note = JSON.parse(localStorage.getItem(key) || '{}'); if (!note || typeof note !== 'object' || Array.isArray(note)) note = {}; }
  catch (_) { unavailable = true; }
  const fields = [
    ['thesis', 'My research thesis', 'What does this business do well, and why does it interest me?'],
    ['assumptions', 'Assumptions to check', 'What must be true for this thesis to hold?'],
    ['invalidate', 'What would change my mind?', 'Write measurable evidence that would weaken the thesis.'],
    ['next', 'Next evidence to check', 'Which filing, result or operating metric should I inspect next?']
  ];
  el.innerHTML = `<div class="research-heading"><div><span class="tag">SOURCE-BASED RESEARCH</span><h2>What changed in the reported business?</h2></div><a href="${h(c.sourceUrl)}" target="_blank" rel="noopener">Read the filing</a></div>
  <p class="sub">${h(c.period)} · ${h(c.unit)} · Filed ${h(c.filed)}</p>
  <p>This compares the current and prior values in the cited filing. ${c.periodType === 'quarter' ? 'Quarterly period, compared with the prior-year quarter.' : 'Annual period, not a quarter-on-quarter comparison.'} Segment definitions can change; check the filing before treating the values as like-for-like.</p>
  <div class="research-totals"><div><small>Comparable lines: prior</small><b>${number(result.comparable ? result.prior : null)}</b></div><div><small>Comparable lines: current</small><b>${number(result.comparable ? result.current : null)}</b></div><div><small>Net revenue change</small><b>${change(result.comparable ? result.delta : null)}</b></div><div><small>Change vs prior</small><b>${result.growth === null ? 'Not available' : change(result.growth) + '%'}</b></div></div>
  <div class="research-scroll"><table class="research-table"><caption>Revenue change by reported line, in ${h(c.unit)}. Sorted from largest revenue increase to largest decline, not an investment ranking.</caption><thead><tr><th scope="col">Reported line</th><th scope="col">Prior</th><th scope="col">Current</th><th scope="col">Change</th><th scope="col">Growth</th></tr></thead><tbody>${sorted.map(s => `<tr><th scope="row">${h(s.name)}</th><td>${number(s.prior)}</td><td>${number(s.current)}</td><td>${change(s.delta)}</td><td>${s.growth === null ? 'Not available' : change(s.growth) + '%'}</td></tr>`).join('')}</tbody></table></div>
  <p class="sub">${result.comparable} comparable lines${result.missing ? `; ${result.missing} excluded from totals because a value is missing` : ''}. Totals cover only the listed lines, not necessarily the whole company's consolidated revenue. Zero prior revenue has no meaningful percentage growth. These are arithmetic changes, not explanations of their cause.</p>
  <hr><h2>My ${h(c.name)} research thesis</h2><p class="sub">Private notes on this device. No broker connection, cloud sync, buy/sell signals or investment advice. Export a backup before clearing browser data.</p>
  <div class="research-fields">${fields.map(([id,label,placeholder]) => `<label>${label}<textarea id="research-${id}" data-field="${id}" maxlength="6000" rows="3" placeholder="${h(placeholder)}">${h(typeof note[id] === 'string' ? note[id] : '')}</textarea></label>`).join('')}</div>
  <div class="acts"><button class="ghost" id="research-export">Export research note</button><button class="ghost" id="research-clear">Clear this company's notes</button></div><p class="sub" role="status" aria-live="polite" id="research-status">${unavailable ? 'Saved notes could not be read. Export any new notes to keep a copy.' : note.updated ? 'Last saved: ' + h(new Date(note.updated).toLocaleString()) : 'No saved thesis yet.'}</p>`;
  const status = el.querySelector('#research-status');
  const collect = () => Object.fromEntries(fields.map(([id]) => [id, el.querySelector('#research-' + id).value]));
  el.querySelectorAll('textarea').forEach(input => input.addEventListener('input', () => {
    const updated = new Date().toISOString();
    try { localStorage.setItem(key, JSON.stringify({ ...collect(), updated })); status.textContent = 'Saved on this device at ' + new Date(updated).toLocaleTimeString(); }
    catch (_) { status.textContent = 'Could not save on this device. Export your notes before leaving this company.'; }
  }));
  el.querySelector('#research-export').addEventListener('click', () => {
    const values = collect();
    const text = `${c.name} (${c.id}) - research note\nExported: ${new Date().toISOString()}\n\nPeriod: ${c.period}\nUnits: ${c.unit}\nSource: ${c.source}\nFiled: ${c.filed}\n${c.sourceUrl}\n\n` +
      fields.map(([id,label]) => label + '\n' + (values[id] || '(not recorded)')).join('\n\n') +
      '\n\nReported revenue changes\n' + result.rows.map(r => `${r.name}: ${number(r.prior)} -> ${number(r.current)}; change ${change(r.delta)} (${c.unit})`).join('\n') +
      '\n\nLearning research tool. Not investment advice. Check the original filing and reporting definitions.\n';
    const url = URL.createObjectURL(new Blob([text], {type:'text/plain;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = c.id + '-research-note.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Research note export requested. Check your downloads.';
  });
  el.querySelector('#research-clear').addEventListener('click', () => {
    if (!confirm('Clear only the saved research notes for ' + c.name + '? Export a copy first if you need it.')) return;
    try { localStorage.removeItem(key); el.querySelectorAll('textarea').forEach(input => {input.value = '';}); status.textContent = 'Notes cleared for this company.'; }
    catch (_) { status.textContent = 'Could not clear saved notes. Browser storage is unavailable.'; }
  });
}
