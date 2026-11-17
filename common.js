/* Wander: helpers shared by index.html and place.html.
   Pages must define `state.userLang` (the reader's language) before calling fmtNum or translateLink. */
"use strict";

/* ---------- text ---------- */
const esc = s => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const cap = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : s;

/* ---------- units (imperial display) ---------- */
const FT = 3.28084;
function fmtDist(m){ const ft = m*FT, mi = m/1609.344;
  return ft<1000 ? Math.round(ft/10)*10+' ft' : mi.toFixed(mi<10?1:0)+' mi'; }
/* Convert a metric quantity to imperial for display; imperial units pass through. */
function toImperial(n, u){
  if(u==='m') return {n:n*FT, u:'ft'};
  if(u==='km²') return {n:n*0.386102, u:'sq mi'};
  if(u==='ha') return {n:n*2.47105, u:'acres'};
  if(u==='m²') return n>=4046.86 ? {n:n/4046.86, u:'acres'} : {n:n*10.7639, u:'sq ft'};
  return {n, u};
}

/* ---------- language names, trimming, fetch ---------- */
let langNames; try{ langNames = new Intl.DisplayNames(['en'],{type:'language'}); }catch(e){ langNames=null; }
const langName = l => { try{ return (langNames && langNames.of(l)) || l; }catch(e){ return l; } };
function trimText(s, n){
  s = (s||'').trim(); if(s.length<=n) return s;
  const slice = s.slice(0,n); let idx=-1;
  for(const p of ['. ','。','！','？','! ','? ','۔ ','। ']){ idx=Math.max(idx, slice.lastIndexOf(p)); }
  return idx > n*0.4 ? slice.slice(0,idx+1) : slice.replace(/\s+\S*$/,'')+'…';
}
async function fetchJSON(url, ms=15000){
  const c=new AbortController(); const t=setTimeout(()=>c.abort(), ms);
  try{ const r=await fetch(url,{signal:c.signal}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); }
  finally{ clearTimeout(t); }
}

/* ---------- Wikidata factoids ---------- */
function fmtTime(t, prec){
  const m = /^([+-]?)(\d+)-/.exec(t||''); if(!m) return null;
  let y = parseInt(m[2],10); const bce = m[1]==='-'; const suf = bce?' BCE':'';
  prec = parseInt(prec,10);
  if(prec>=9) return y+suf;
  if(prec===8) return (Math.floor(y/10)*10)+'s'+suf;
  if(prec===7){ const c=Math.ceil(y/100)||1; const o=(c%100>10&&c%100<14)?'th':({1:'st',2:'nd',3:'rd'}[c%10]||'th'); return c+o+' century'+suf; }
  return null;
}

/* ---------- page language ---------- */
/* Browsers offer to translate a page based on its declared language (<html lang>). When most of what is on
   screen is in the local language (Japanese in Kyoto, say), declare that, so the browser's translator is offered.
   Wander's own buttons and labels sit under <body lang="en">; content passages carry their own lang attributes. */
function updatePageLang(root, readerLang){
  const weight = {ja:2.5, zh:2.5, ko:2}, counts = {}; let total = 0;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for(let n; (n = walk.nextNode());){
    const t = n.nodeValue.trim(), el = n.parentElement; if(!t || !el || el.closest('[hidden],script,style')) continue;
    const owner = el.closest('[lang]'), l = ((owner && owner !== document.documentElement && owner.lang) || 'en').split('-')[0].toLowerCase();
    const c = t.length * (weight[l] || 1); counts[l] = (counts[l] || 0) + c; total += c;
  }
  const ranked = Object.entries(counts).sort((a,b)=>b[1]-a[1]); if(!ranked.length) return;
  const other = ranked.find(([l])=>l !== readerLang);
  const pick = other && other[1]/total >= .4 ? other[0] : ranked[0][0];
  if(document.documentElement.lang !== pick) document.documentElement.lang = pick;
}

/* ---------- Wikipedia ---------- */
function wikiURL(lang, params){
  return `https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({format:'json', formatversion:'2', origin:'*', ...params});
}

async function extractsFor(lang, titles, chars){
  const out = {};
  for(let i=0;i<titles.length;i+=20){
    const batch = titles.slice(i,i+20);
    const d = await fetchJSON(wikiURL(lang, {action:'query', titles:batch.join('|'), redirects:'1', prop:'extracts|info|pageimages',
      exintro:'1', explaintext:'1', exlimit:'20', inprop:'url', piprop:'thumbnail', pithumbsize:'250', pilimit:'20'}));
    const map = {}; batch.forEach(t=>map[t]=t);
    (d.query?.normalized||[]).forEach(n=>{ for(const k in map) if(map[k]===n.from) map[k]=n.to; });
    (d.query?.redirects||[]).forEach(n=>{ for(const k in map) if(map[k]===n.from) map[k]=n.to; });
    const pages = {}; (d.query?.pages||[]).forEach(p=>{ if(!p.missing) pages[p.title]=p; });
    for(const k in map){ const p=pages[map[k]]; if(p) out[k]={title:p.title, extract:p.extract||'', url:p.fullurl, thumb:p.thumbnail?.source}; }
  }
  return out;
}

function translateLink(lang, title){
  const host = lang.replace(/-/g,'--') + '-wikipedia-org.translate.goog';
  return `https://${host}/wiki/${encodeURIComponent(title.replace(/ /g,'_'))}?_x_tr_sl=${lang}&_x_tr_tl=${state.userLang}&_x_tr_hl=${state.userLang}`;
}

/* ---------- Wikidata queries, numbers and history timelines ---------- */
const sparql = q => fetchJSON('https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(q), 25000).then(d=>d.results.bindings);
const UNITS = {Q712226:'km²', Q25343:'m²', Q35852:'ha', Q232291:'sq mi', Q11573:'m', Q3710:'ft', Q81292:'acres'};
const unitOf = uri => UNITS[(uri||'').split('/').pop()] || '';
const isQ = s => /^Q\d+$/.test(s||'');
function fmtNum(n, compact){
  try{ return new Intl.NumberFormat(state.userLang, compact && n>=1e6 ? {notation:'compact', compactDisplay:'long', maximumSignificantDigits:3} : {maximumFractionDigits: n<100?1:0}).format(n); }
  catch(e){ return String(Math.round(n)); }
}
const HIST_RE = /histor|geschicht|storia|dějiny|dejiny|dzieje|tarih|歴史|历史|歷史|沿革|역사|lịch sử|ιστορ|истори|істор|geschiedenis|sejarah|ประวัติ|تاريخ|היסטוריה|povijest|istorija|zgodovina|történet/i;
function historySection(text){
  const lines = text.split('\n'); const out=[]; let inHist=false, level=0;
  for(const ln of lines){
    const m = /^(=+)\s*(.*?)\s*=+\s*$/.exec(ln);
    if(m){ const lv=m[1].length; if(inHist && lv<=level) break; if(!inHist && HIST_RE.test(m[2])){ inHist=true; level=lv; } continue; }
    if(inHist) out.push(ln);
  }
  return out.join(' ').trim();
}
let SENT_RE = null;
try{ SENT_RE = new RegExp('(?<=[.!?])\\s+(?=[A-ZÀ-ÖØ-Þ0-9"“‘(\\u0370-\\u03FF\\u0400-\\u04FF\\u0590-\\u05FF\\u0600-\\u06FF])|(?<=[。！？])'); }catch(e){}
function sentences(t){
  t = t.replace(/\s+/g,' ').trim(); if(!t) return [];
  let parts = SENT_RE ? t.split(SENT_RE) : (t.match(/[^.!?。！？]+[.!?。！？]*/g) || []);
  const out = [];
  for(const p of parts.map(s=>s.trim()).filter(Boolean)){
    const prev = out[out.length-1];
    if(prev && /(?:^|\s)(St|Dr|Mt|Mr|Mrs|Ms|Jr|Sr|ca|c|Ft|No|vs|Ste|Sta|Sto|Hl|hl|bzw|z\.B|u\.a|e\.g|i\.e|[A-Z])\.$/.test(prev)) out[out.length-1] = prev+' '+p;
    else out.push(p);
  }
  return out;
}
function yearOf(s){
  let m;
  if((m = /紀元前\s*(\d{1,4})\s*年/.exec(s)) || (m = /公元前\s*(\d{1,4})\s*年/.exec(s))) return {y:-m[1], label:m[1]+' BC'};
  if((m = /(?:^|[^\d])(\d{3,4})\s*年/.exec(s))) return {y:+m[1], label:m[1]};
  if((m = /\b(\d{1,4})\s*(?:BCE|BC|v\. ?Chr\.|av\. J\.-C\.|a\. ?C\.|a\.C\.|до н\. ?э\.|п\.н\.е\.|př\. n\. l\.)/.exec(s))) return {y:-m[1], label:m[1]+' BC'};
  if((m = /(?:^|[^\d.,\/:\-–])(1[0-9]{3}|20[0-2][0-9])(s?)(?![\d])/.exec(s))) return {y:+m[1], label:m[1]+m[2]};
  if((m = /\b(?:in|In|im|Im|en|En|em|Em|nel|Nel|w|W|в|В|AD|CE|anno|Anno)\s+(\d{3})(?![\d])/.exec(s))) return {y:+m[1], label:m[1]};
  if((m = /\b(\d{1,2})(?:th|st|nd|rd)\s+century/i.exec(s))) return {y:m[1]*100-50, label:m[1]+(['th','st','nd','rd'][(m[1]%100>10&&m[1]%100<14)?0:(m[1]%10<4?m[1]%10:0)])+' c.'};
  return null;
}
function timeline(text, n=5){
  const pick = src => {
    const cjk = /[぀-ヿ一-鿿가-힯]/;
    const seen = new Set(), rows = [];
    for(const s of sentences(src)){
      const L = s.length, isC = cjk.test(s);
      if(isC ? (L<12 || L>170) : (L<40 || L>320)) continue;
      const y = yearOf(s); if(!y || seen.has(y.y)) continue;
      seen.add(y.y); rows.push({...y, s}); if(rows.length>=80) break;
    }
    rows.sort((a,b)=>a.y-b.y);
    if(rows.length<=n) return rows;
    const out=[]; for(let i=0;i<n;i++){ const r=rows[Math.round(i*(rows.length-1)/(n-1))]; if(!out.includes(r)) out.push(r); }
    return out;
  };
  let rows = pick(historySection(text));
  if(rows.length<3) rows = pick(text.replace(/^=+.*=+\s*$/gm,' '));
  return rows;
}
async function fullText(lang, title){
  const d = await fetchJSON(wikiURL(lang, {action:'query', prop:'extracts', explaintext:'1', exsectionformat:'wiki', redirects:'1', titles:title}), 20000);
  return (d.query && d.query.pages && d.query.pages[0] && d.query.pages[0].extract) || '';
}

/* ---------- "Did you know" factoids from Wikidata ---------- */
const joinAnd = L => L.length < 2 ? (L[0]||'') : L.slice(0,-1).join(', ') + ' and ' + L[L.length-1];
/* One query per place: each part picks the best-known few items (by number of Wikipedia editions). */
function qFactoids(q, kind, ul){
  const top = (rel, pred) => `{ SELECT ("${rel}" AS ?rel) ?x ?links WHERE { ?x ${pred} wd:${q}; wikibase:sitelinks ?links. FILTER(?links > 0) } ORDER BY DESC(?links) LIMIT 3 }`;
  const count = (rel, pred) => `{ SELECT ("${rel}#" AS ?rel) (COUNT(DISTINCT ?x) AS ?n) WHERE { ?x ${pred} wd:${q} } }`;
  const parts = [
    top('set', 'wdt:P840'), count('set', 'wdt:P840'),          // works set here
    top('film', 'wdt:P915'), count('film', 'wdt:P915'),        // filmed here
    top('named', 'wdt:P138'),                                   // named after this place
    `{ SELECT ("event" AS ?rel) ?x ?links (MIN(?t) AS ?date) WHERE { ?x wdt:P276 wd:${q}; wdt:P585 ?t; wikibase:sitelinks ?links. FILTER(?links > 1) } GROUP BY ?x ?links ORDER BY DESC(?links) LIMIT 3 }`,
    `{ SELECT ("depict" AS ?rel) ?x ?links (SAMPLE(?c) AS ?by) WHERE { ?x wdt:P180 wd:${q}; wdt:P170 ?c; wikibase:sitelinks ?links. FILTER(?links > 0) } GROUP BY ?x ?links ORDER BY DESC(?links) LIMIT 3 }`
  ];
  if(kind==='area') parts.push(
    `{ SELECT ("oldest" AS ?rel) ?x ?date ?prec WHERE { ?x wdt:P131 wd:${q}; wdt:P625 []; p:P571/psv:P571 [ wikibase:timeValue ?date; wikibase:timePrecision ?prec ]. FILTER(?prec >= 7) } ORDER BY ?date LIMIT 1 }`,
    `{ SELECT ("tallest" AS ?rel) ?x ?amt ?unit WHERE { ?x wdt:P131 wd:${q}; wdt:P625 []; p:P2048/psv:P2048 [ wikibase:quantityAmount ?amt; wikibase:quantityUnit ?unit ]. } ORDER BY DESC(?amt) LIMIT 1 }`,
    `{ SELECT ("heritage#" AS ?rel) (COUNT(DISTINCT ?x) AS ?n) WHERE { ?x wdt:P131 wd:${q}; wdt:P1435 []. } }`);
  else parts.push(
    top('lived', 'wdt:P551'),                                  // residents
    top('buried', 'wdt:P119'), count('buried', 'wdt:P119'),    // burials
    top('died', 'wdt:P20'),                                    // died here
    `{ SELECT ("home" AS ?rel) ?x ?links WHERE { wd:${q} wdt:P466 ?x. ?x wikibase:sitelinks ?links. } ORDER BY DESC(?links) LIMIT 3 }`);   // occupants
  return `SELECT ?rel ?x ?xLabel ?links ?n ?date ?prec ?amt ?unit ?by ?byLabel WHERE {
    ${parts.join('\n    UNION ')}
    SERVICE wikibase:label { bd:serviceParam wikibase:language "${ul},en". } }`;
}
/* Turn factoid rows into short sentences (HTML). */
function factoidList(rows, self){
  const by = {}, real = v => v && !isQ(v) && !/^https?:/.test(v);
  const same = v => self && (v.toLowerCase()===self.toLowerCase() || v.toLowerCase().startsWith(self.toLowerCase()+' ('));
  for(const r of rows) (by[r.rel.value] = by[r.rel.value] || []).push(r);
  const items = rel => { const seen = new Set(); return (by[rel]||[]).filter(r=>r.xLabel && real(r.xLabel.value) && !(rel==='named' && same(r.xLabel.value)))
    .sort((a,b)=>(+(b.links||{}).value||0)-(+(a.links||{}).value||0)).filter(r=>!seen.has(r.xLabel.value) && seen.add(r.xLabel.value)); };
  const count = rel => { const r = (by[rel+'#']||[])[0]; return r && r.n ? +r.n.value : 0; };
  const work = s => `<i>${esc(s)}</i>`, out = [];
  const list = (rel, fmt, one, many) => { const L = items(rel); if(!L.length) return; const n = count(rel), l = joinAnd(L.map(fmt)); out.push(n > L.length ? many(fmtNum(n), l) : one(l)); };
  list('set', r=>work(r.xLabel.value), l=>`The setting of ${l}.`, (n,l)=>`The setting of ${n} books, films and other works, including ${l}.`);
  list('film', r=>work(r.xLabel.value), l=>`A filming location for ${l}.`, (n,l)=>`A filming location for ${n} films and shows, including ${l}.`);
  list('event', r=>{ const y = r.date ? fmtTime(r.date.value, 9) : ''; return esc(r.xLabel.value) + (y && !r.xLabel.value.includes(y) ? ` (${esc(y)})` : ''); }, l=>`Scene of ${l}.`);
  list('depict', r=>work(r.xLabel.value) + (r.byLabel && real(r.byLabel.value) ? ` by ${esc(r.byLabel.value)}` : ''), l=>`Pictured in ${l}.`);
  list('lived', r=>esc(r.xLabel.value), l=>`Once home to ${l}.`);
  list('home', r=>esc(r.xLabel.value), l=>`Home to ${l}.`);
  list('buried', r=>esc(r.xLabel.value), l=>`The final resting place of ${l}.`, (n,l)=>`The final resting place of ${n} notable people, including ${l}.`);
  list('died', r=>esc(r.xLabel.value), l=>`Where ${l} died.`);
  list('named', r=>esc(r.xLabel.value), l=>`Gave its name to ${l}.`);
  const old = items('oldest')[0];
  if(old && yearNum(old.date.value) <= new Date().getFullYear() - 75){ const y = fmtTime(old.date.value, old.prec && old.prec.value); if(y) out.push(`Among its oldest landmarks is ${esc(old.xLabel.value)}, from ${esc(y)}.`); }
  const tall = items('tallest')[0];
  if(tall && tall.amt){ const q = toImperial(+tall.amt.value, unitOf(tall.unit && tall.unit.value)); if(q.u==='ft') out.push(`Among its tallest structures is ${esc(tall.xLabel.value)}, at ${esc(fmtNum(q.n))} ft.`); }
  const her = count('heritage');
  if(her >= 3) out.push(`At least ${esc(fmtNum(her))} heritage-listed places lie within its borders.`);
  return out;
}
const factoidsHTML = F => F && F.length ? `<h4>Did you know</h4><ul class="factoids">${F.map(f=>`<li>${f}</li>`).join('')}</ul>` : '';

/* ---------- Per-place fact sheet (loaded when "More" is tapped) ---------- */
const yearNum = t => { const m = /^([+-]?)(\d+)-/.exec(t||''); return m ? (m[1]==='-' ? -m[2] : +m[2]) : null; };
function qPlace(q, ul){
  return `SELECT ?kind ?pid ?val ?valLabel ?amt ?unit ?time ?prec WHERE {
    { BIND("v" AS ?kind)
      VALUES ?pid { wd:P31 wd:P84 wd:P149 wd:P1435 wd:P138 wd:P417 wd:P140 wd:P112 wd:P170 wd:P547 wd:P186 wd:P361 wd:P88 wd:P127 }
      ?pid wikibase:directClaim ?wdt. wd:${q} ?wdt ?val. FILTER(isIRI(?val)) }
    UNION
    { BIND("n" AS ?kind)
      VALUES ?pid { wd:P571 wd:P1619 wd:P576 wd:P2048 wd:P1101 wd:P1174 wd:P2049 }
      ?pid wikibase:claim ?p; wikibase:statementValue ?psv.
      wd:${q} ?p ?st. ?st ?psv ?node. ?st wikibase:rank ?r. FILTER(?r != wikibase:DeprecatedRank)
      OPTIONAL { ?node wikibase:timeValue ?time; wikibase:timePrecision ?prec }
      OPTIONAL { ?node wikibase:quantityAmount ?amt; wikibase:quantityUnit ?unit } }
    UNION
    { BIND("e" AS ?kind) BIND(wd:P793 AS ?pid)
      wd:${q} p:P793 ?st. ?st ps:P793 ?val.
      OPTIONAL { ?st pqv:P585 ?tn. ?tn wikibase:timeValue ?time; wikibase:timePrecision ?prec } }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "${ul},en". }
  } LIMIT 300`;
}
function placeFacts(rows, m){
  const by = {};
  for(const r of rows){ const pid = r.pid.value.split('/').pop(); (by[pid] = by[pid] || []).push(r); }
  const labels = pid => [...new Set((by[pid]||[]).filter(r=>r.kind.value==='v').map(r=>r.valLabel && r.valLabel.value).filter(v=>v && !isQ(v)))];
  const time = pid => { const r = (by[pid]||[]).find(r=>r.kind.value==='n' && r.time); return r ? fmtTime(r.time.value, r.prec && r.prec.value) : null; };
  const qty = pid => { const r = (by[pid]||[]).find(r=>r.kind.value==='n' && r.amt); return r ? {n:Math.abs(+r.amt.value), u:unitOf(r.unit && r.unit.value)} : null; };
  const add = (l, v) => { if(v) m.facts.push([l, esc(v)]); };
  const list = (pid, n) => { const L = labels(pid); return L.length ? L.slice(0,n).map(cap).join(', ') : null; };
  add('Type', list('P31', 2));
  add('Founded', time('P571')); add('Opened', time('P1619')); add('Closed', time('P576'));
  add('Architect', list('P84', 2)); add('Style', list('P149', 2));
  add('Founded by', list('P112', 2)); add('Created by', list('P170', 2)); add('Commissioned by', list('P88', 1));
  add('Named after', list('P138', 2)); add('Dedicated to', list('P417', 2)); add('Commemorates', list('P547', 2));
  add('Religion', list('P140', 1)); add('Material', list('P186', 3)); add('Part of', list('P361', 1)); add('Owned by', list('P127', 1));
  const h = qty('P2048'); if(h){ const q = toImperial(h.n, h.u||'m'); add('Height', fmtNum(q.n)+' '+q.u); }
  const f = qty('P1101'); if(f) add('Floors', fmtNum(f.n));
  const v = qty('P1174'); if(v) add('Visitors a year', fmtNum(v.n, true));
  add('Heritage', list('P1435', 1));
  m.events = (by.P793||[]).filter(r=>r.kind.value==='e' && r.time && r.valLabel && !isQ(r.valLabel.value))
    .map(r=>({y:yearNum(r.time.value), label:fmtTime(r.time.value, r.prec && r.prec.value), s:cap(r.valLabel.value)}))
    .filter(e=>e.y!=null && e.label);
}

/* ---------- AI guides: research done in Claude or ChatGPT, handed back to Wander ---------- */
/* A guide is the data block the assistant adds to its pamphlet. It arrives as a "Send to Wander" link
   (…#import=<base64url JSON>) or as pasted JSON. Everything in it came from web pages via the assistant,
   so it is treated as untrusted text: plain strings only, http(s) links only, sizes capped. */
const GUIDE_KEY = 'wander.guides', GUIDE_MAX = 20;
function decodeGuidePayload(text){
  let s = String(text || '').trim();
  const hash = s.indexOf('#import=');
  if(hash >= 0) s = s.slice(hash + 8).trim();
  if(!s.includes('{')){   // a link's code: base64url (or percent-encoded) JSON
    try{ s = decodeURIComponent(s); }catch(e){}
    if(!s.includes('{')){
      try{
        const b64 = s.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/=]/g, '').replace(/=+$/, '');
        const bin = atob(b64 + '==='.slice((b64.length + 3) % 4).slice(0, (4 - b64.length % 4) % 4));
        s = new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
      }catch(e){ throw new Error('No guide data found'); }
    }
  }
  const a = s.indexOf('{'), z = s.lastIndexOf('}');
  if(a < 0 || z <= a) throw new Error('No guide data found');
  let data; try{ data = JSON.parse(s.slice(a, z + 1)); }catch(e){ throw new Error('The guide data is incomplete — copy the whole block'); }
  return normalizeGuide(data);
}
function normalizeGuide(g){
  if(!g || typeof g !== 'object') throw new Error('Not a guide');
  const str = (v, n) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, n) : '';   // plain text only
  const num = (v, lo, hi) => { const x = typeof v === 'string' ? parseFloat(v) : v; return typeof x === 'number' && isFinite(x) && x >= lo && x <= hi ? x : null; };
  const arr = (v, n, f) => Array.isArray(v) ? v.slice(0, n).map(f).filter(Boolean) : [];
  const url = v => { const u = str(v, 600); return /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : ''; };
  const sources = v => arr(v, 8, s => { const u = url(s && s.url); return u ? {title: str(s.title, 120) || u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0], url: u} : null; });
  const timeline = v => arr(v, 12, t => { const text = str(t && t.text, 300), date = str(t && t.date, 40); return text ? {date, text} : null; });
  const body = p => ({ summary: str(p.summary, 900), keyPoints: arr(p.keyPoints, 6, k => str(k, 300)), timeline: timeline(p.timeline),
    trivia: arr(p.trivia, 6, k => str(k, 300)), sources: sources(p.sources) });
  const places = arr(g.places, 40, p => {
    if(!p || typeof p !== 'object') return null;
    const name = str(p.name, 120); if(!name) return null;
    const id = typeof p.id === 'string' && /^Q\d+$/.test(p.id.trim()) ? p.id.trim() : null;
    const lat = num(p.lat, -90, 90), lon = num(p.lon, -180, 180);
    if(!id && (lat == null || lon == null)) return null;   // a new place needs a position
    return {id, name, localName: str(p.localName, 120), lat, lon, confidence: ['high','medium','low'].includes(p.confidence) ? p.confidence : '', ...body(p)};
  });
  const ar = g.area && typeof g.area === 'object' ? g.area : {};
  const area = {name: str(ar.name, 120), lat: num(ar.lat, -90, 90), lon: num(ar.lon, -180, 180), ...body(ar)};
  if(!places.length && !area.summary) throw new Error('The guide has no places');
  return {area, places};
}
function loadGuides(){ try{ const v = JSON.parse(localStorage.getItem(GUIDE_KEY) || '[]'); return Array.isArray(v) ? v : []; }catch(e){ return []; } }
function saveGuides(list){ try{ localStorage.setItem(GUIDE_KEY, JSON.stringify(list.slice(-GUIDE_MAX))); return true; }catch(e){ return false; } }
function addGuide(g){
  const list = loadGuides().filter(x => !(x.area && g.area && x.area.name && x.area.name === g.area.name));   // a new guide for the same area replaces the old one
  const saved = {...g, id: Date.now().toString(36), savedAt: Date.now()};
  list.push(saved); saveGuides(list); return saved;
}
/* The newest guide entry for a Wikidata ID, if any */
function guideFor(qid){ let hit = null; for(const g of loadGuides()) for(const p of g.places || []) if(p.id === qid) hit = p; return hit; }
