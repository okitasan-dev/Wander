/* Wander version: major.minor.patch — major for big changes, minor for medium, patch for small.
   When it changes, also update ?v= on the common.js script tags in index.html and place.html, and APP in sw.js. */
const WANDER_VERSION = '2.6.0';

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

/* ---------- Google Maps ---------- */
/* Opens Google Maps (the app if installed) with a pin dropped on the exact spot */
const mapsURL = (lat, lon) => `https://www.google.com/maps/search/?api=1&query=${(+lat).toFixed(6)},${(+lon).toFixed(6)}`;

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
  let data; try{ data = JSON.parse(s.slice(a, z + 1)); }catch(e){ data = salvageGuide(s.slice(a)); }
  const g = normalizeGuide(data);
  if(data.partial) g.partial = true;
  return g;
}
/* A reply that stopped partway: keep the area and every place whose data arrived complete */
function salvageGuide(s){
  const take = i => { const end = endOf(s, i); try{ return {o: JSON.parse(s.slice(i, end)), end}; }catch(e){ return null; } };
  const am = /"area"\s*:\s*\{/.exec(s), area = am ? (take(am.index + am[0].length - 1) || {}).o : null;
  const pm = /"places"\s*:\s*\[/.exec(s), places = [];
  if(pm){
    let i = pm.index + pm[0].length;
    for(;;){
      while(i < s.length && /[\s,]/.test(s[i])) i++;
      if(s[i] !== '{') break;
      const t = take(i); if(!t) break;   // this place was cut off: stop here
      places.push(t.o); i = t.end;
    }
  }
  if(!places.length && !area) throw new Error('The guide data is incomplete — copy the whole block');
  return {wander: 1, area: area || {}, places, partial: true};
}
/* Index just past the {...} that starts at s[i] (the end of the text if it never closes) */
function endOf(s, i){
  let depth = 0, str = false, esc = false;
  for(let j = i; j < s.length; j++){
    const c = s[j];
    if(str){ if(esc) esc = false; else if(c === '\\') esc = true; else if(c === '"') str = false; continue; }
    if(c === '"') str = true; else if(c === '{') depth++; else if(c === '}' && --depth === 0) return j + 1;
  }
  return s.length;
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
    trivia: arr(p.trivia, 6, k => str(k, 300)), sources: sources(p.sources),
    terms: arr(p.terms, 8, t => { const text = str(t && t.text, 80), title = str(t && (t.wiki || t.title), 150), lang = String((t && t.lang) || 'en').toLowerCase();
      return text && title && /^[a-z]{2,3}(-[a-z]+)?$/.test(lang) ? {text, title, lang} : null; }) });
  const places = arr(g.places, 40, p => {
    if(!p || typeof p !== 'object') return null;
    const name = str(p.name, 120); if(!name) return null;
    const id = typeof p.id === 'string' && /^Q\d+$/.test(p.id.trim()) ? p.id.trim() : null;
    const lat = num(p.lat, -90, 90), lon = num(p.lon, -180, 180);
    const address = str(p.address, 200);
    if(!id && (lat == null || lon == null) && !address) return null;   // a new place needs a position, or an address Wander can look up
    return {id, name, localName: str(p.localName, 120), kind: str(p.kind, 60), seeToday: str(p.seeToday, 300), located: str(p.located, 200), address, folklore: p.folklore === true, lat, lon, confidence: ['high','medium','low'].includes(p.confidence) ? p.confidence : '', ...body(p)};
  });
  const ar = g.area && typeof g.area === 'object' ? g.area : {};
  const area = {name: str(ar.name, 120), lat: num(ar.lat, -90, 90), lon: num(ar.lon, -180, 180), ...body(ar)};
  if(!places.length && !area.summary) throw new Error('The guide has no places');
  return {area, places};
}
function loadGuides(){ try{ const v = JSON.parse(localStorage.getItem(GUIDE_KEY) || '[]'); return Array.isArray(v) ? v : []; }catch(e){ return []; } }
function saveGuides(list){ try{ localStorage.setItem(GUIDE_KEY, JSON.stringify(list.slice(-GUIDE_MAX))); return true; }catch(e){ return false; } }
/* ---- merging: guides for the same area combine; the same place found twice becomes one ---- */
const GUIDE_AREA_M = 800, GUIDE_PLACE_M = 150;   // guides centred within half a mile merge; places normally within ~500 ft to match
const metres = (a, b) => { const r = Math.PI/180, dLat = (b.lat-a.lat)*r, dLon = (b.lon-a.lon)*r;
  const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLon/2)**2; return 2*6371000*Math.asin(Math.sqrt(x)); };
const GUIDE_STOP = new Set(['the','a','an','of','and','at','in','on','site','former','old','historic','historical','area','reported']);
const nameTokens = n => new Set(String(n||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase()
  .replace(/['’]s\b/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').split(' ').filter(w => w && !GUIDE_STOP.has(w)));
function nameOverlap(a, b){ const A = nameTokens(a), B = nameTokens(b); if(!A.size || !B.size) return {jac: 0, cont: 0, shared: 0};
  let n = 0; for(const w of A) if(B.has(w)) n++; return {jac: n / (A.size + B.size - n), cont: n / Math.min(A.size, B.size), shared: n}; }
const nameSim = (a, b) => nameOverlap(a, b).jac;
const hasPos = p => p && p.lat != null && p.lon != null;
/* Same place? Same Wikidata ID: yes. Different IDs: no. Otherwise similar names close together
   (a stricter name match when only one of them has an ID, so "City Hall" and "First City Hall site" stay apart). */
function samePlace(a, b){
  if(a.id && b.id) return a.id === b.id;
  if(!hasPos(a) || !hasPos(b)) return false;
  const d = metres(a, b), o = nameOverlap(a.name, b.name);
  if(a.id || b.id) return d <= GUIDE_PLACE_M && o.jac >= .8;
  // Assistants' pins for the same place can disagree by a lot, so a more distinctive name match allows a wider gap
  return (d <= GUIDE_PLACE_M && o.jac >= .5)
      || (d <= 400 && o.shared >= 2 && o.cont >= .66)
      || (d <= 2500 && o.shared >= 3 && o.jac >= .75);
}
const CONF = {high:3, medium:2, low:1};
const normText = t => String(t||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const unionBy = (list, key, max) => { const seen = new Set(), out = []; for(const x of list){ const k = key(x); if(k && !seen.has(k)){ seen.add(k); out.push(x); } } return out.slice(0, max); };
const byDate = list => list.map((t, i) => ({t, i, y: (yearOf(t.date) || yearOf(t.text) || {}).y})).sort((a, b) => (a.y ?? 1e9) - (b.y ?? 1e9) || a.i - b.i).map(x => x.t);
/* Combine two versions of a place or area; b is the newer one */
function mergeEntry(a, b){
  const better = (CONF[b.confidence]||0) >= (CONF[a.confidence]||0) && hasPos(b) ? b : hasPos(a) ? a : b;   // the more precisely located
  return {...a, ...b,
    id: a.id || b.id || null, name: b.name || a.name, localName: b.localName || a.localName, kind: b.kind || a.kind,
    lat: better.lat ?? a.lat ?? null, lon: better.lon ?? a.lon ?? null, located: better.located || b.located || a.located || '', confidence: better.confidence || b.confidence || a.confidence || '',
    summary: b.summary || a.summary, seeToday: b.seeToday || a.seeToday,
    keyPoints: unionBy([...(b.keyPoints||[]), ...(a.keyPoints||[])], normText, 8),
    timeline: byDate(unionBy([...(a.timeline||[]), ...(b.timeline||[])], t => (t.date||'') + '|' + normText(t.text).slice(0, 40), 14)),
    trivia: unionBy([...(b.trivia||[]), ...(a.trivia||[])], normText, 8),
    sources: unionBy([...(b.sources||[]), ...(a.sources||[])], s => s.url, 12),
    terms: unionBy([...(b.terms||[]), ...(a.terms||[])], t => t.text.toLowerCase(), 10)};
}
const guideCentre = g => { if(g.area && hasPos(g.area)) return g.area;
  const ps = (g.places||[]).filter(hasPos); return ps.length ? {lat: ps.reduce((s, p) => s + p.lat, 0)/ps.length, lon: ps.reduce((s, p) => s + p.lon, 0)/ps.length} : null; };
/* Fold a newly imported guide into storage: merge with a guide for the same area, or add it. Returns what happened. */
function addGuide(g){
  const list = loadGuides(), c = guideCentre(g);
  const host = c && list.slice().reverse().find(x => { const xc = guideCentre(x); return xc && metres(xc, c) <= GUIDE_AREA_M; });
  if(!host){
    const saved = {...g, id: Date.now().toString(36), savedAt: Date.now(), count: 1, latest: g};
    list.push(saved); saveGuides(list); return {guide: saved, merged: false, added: g.places.length, updated: 0};
  }
  const places = (host.places || []).slice(); let added = 0, updated = 0;
  for(const p of g.places){
    const i = places.findIndex(q => samePlace(q, p));
    if(i >= 0){ places[i] = mergeEntry(places[i], p); updated++; } else { places.push(p); added++; }
  }
  const area = mergeEntry(host.area || {}, g.area || {});
  area.name = (host.area && host.area.name) || area.name; area.lat = host.area && host.area.lat != null ? host.area.lat : area.lat; area.lon = host.area && host.area.lon != null ? host.area.lon : area.lon;
  const merged = {...host, area, places, count: (host.count || 1) + 1, savedAt: Date.now(), latest: g};
  saveGuides([...list.filter(x => x !== host), merged]);
  return {guide: merged, merged: true, added, updated};
}
/* Keep only the newest guide imported for that area */
function guideStartFresh(id){ const list = loadGuides(); const i = list.findIndex(g => g.id === id); if(i < 0 || !list[i].latest) return;
  list[i] = {...list[i], area: list[i].latest.area, places: list[i].latest.places, count: 1, savedAt: Date.now()}; saveGuides(list); }
/* The newest guide entry for a Wikidata ID, if any */
function guideFor(qid){ let hit = null; for(const g of loadGuides()) for(const p of g.places || []) if(p.id === qid) hit = p; return hit; }

/* ---------- Translation: in place, Google Translate, or Claude ---------- */
/* Under any passage in another language: [Translate] translates it here; [Google] and [Claude] open it there.
   Translations are kept on the device so a passage is only translated once. */
const XL = {texts: new Map(), shown: new Set(), cache: null};
function xlCache(){ if(!XL.cache){ try{ XL.cache = JSON.parse(localStorage.getItem('wander.xl') || '{}'); }catch(e){ XL.cache = {}; } } return XL.cache; }
function xlSave(){ try{ const c = xlCache(), keys = Object.keys(c); for(const k of keys.slice(0, Math.max(0, keys.length - 300))) delete c[k]; localStorage.setItem('wander.xl', JSON.stringify(c)); }catch(e){} }
const xlKey = (lang, text) => { const s = lang + '|' + text; let h = 2166136261; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return 'x' + (h >>> 0).toString(36) + s.length.toString(36); };
function claudeTranslateURL(text, lang, about){
  const to = langName(state.userLang);
  const prompt = `Translate this ${langName(lang)} text into ${to}${about ? ` (it is about ${about})` : ''}.
- Translate faithfully and completely; do not summarise.
- The first time a place or person is named, give the name in ${to === 'English' ? 'romanised' : 'your'} form with the original script in brackets.
- Where a ${to}-speaking reader would need it, explain a historical or cultural term briefly in brackets.
- Reply with the translation only, then one line listing any terms you explained.

${text.slice(0, 4000)}`;
  return 'https://claude.ai/new?q=' + encodeURIComponent(prompt);
}
function xlateHTML(text, lang, opts = {}){
  const ul = state.userLang; text = String(text || '').trim();
  if(!text || !lang || lang.split('-')[0] === ul) return '';
  const k = xlKey(lang, text); XL.texts.set(k, {text, lang, opts});
  const tr = XL.shown.has(k) && xlCache()[k];
  const google = opts.googleURL || `https://translate.google.com/?sl=${encodeURIComponent(lang)}&tl=${ul}&op=translate&text=${encodeURIComponent(text.slice(0, 1800))}`;
  return `<div class="xl" data-xl="${k}">${tr ? `<p class="xl-out" lang="${esc(ul)}">${esc(tr)}<small>Machine translation · ${esc(langName(lang))}</small></p>` : ''}<span class="xl-row">`
    + `<button type="button" class="xl-b" data-xl-act="in">${tr ? 'Hide translation' : 'Translate'}</button>`
    + `<a class="xl-b" target="_blank" rel="noopener" href="${esc(google)}">Google</a>`
    + `<a class="xl-b" target="_blank" rel="noopener" href="${esc(claudeTranslateURL(text, lang, opts.about))}">Claude</a></span></div>`;
}
/* Split text into pieces of at most n UTF-8 bytes, at sentence breaks where possible */
function xlChunks(text, n){
  const enc = new TextEncoder(), out = []; let cur = '';
  const push = piece => { if(enc.encode(piece).length <= n){ out.push(piece); return; } let part = ''; for(const ch of piece){ if(enc.encode(part + ch).length > n){ out.push(part); part = ''; } part += ch; } if(part) out.push(part); };
  for(const line of text.split(/\n+/)){
    for(const s of sentences(line)){ const next = cur ? cur + ' ' + s : s; if(enc.encode(next).length > n && cur){ push(cur); cur = s; } else cur = next; }
    if(cur){ push(cur); cur = ''; }
    out.push('\n');
  }
  return out.filter((x, i, a) => !(x === '\n' && (i === 0 || a[i-1] === '\n'))).slice(0, -1);
}
async function machineTranslate(text, from, to){
  // The browser's own on-device translator where it has one (desktop Chrome); otherwise MyMemory, a free service
  // (only when the language is already on the device, and never waiting long: it can stall)
  const within = (ms, p) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('slow')), ms))]);
  try{
    if('Translator' in self){
      const av = await within(1500, self.Translator.availability({sourceLanguage: from, targetLanguage: to}));
      if(av === 'available'){ const t = await within(4000, self.Translator.create({sourceLanguage: from, targetLanguage: to})); return await within(8000, t.translate(text)); }
    }
  }catch(e){}
  let out = '';
  for(const c of xlChunks(text, 480)){
    if(c === '\n'){ out += '\n'; continue; }
    const d = await fetchJSON('https://api.mymemory.translated.net/get?' + new URLSearchParams({q: c, langpair: `${from}|${to}`}), 15000);
    const t = d && d.responseData && d.responseData.translatedText;
    if(!t || +d.responseStatus !== 200 || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(t)) throw new Error('quota');
    out += (out && !out.endsWith('\n') ? ' ' : '') + t;
  }
  return out;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-xl-act]'); if(!b) return;
  const box = b.closest('[data-xl]'), k = box.dataset.xl, item = XL.texts.get(k); if(!item) return;
  if(XL.shown.has(k)){ XL.shown.delete(k); box.outerHTML = xlateHTML(item.text, item.lang, item.opts); return; }
  if(!xlCache()[k]){
    b.disabled = true; b.textContent = 'Translating…';
    try{ xlCache()[k] = await machineTranslate(item.text, item.lang.split('-')[0], state.userLang); xlSave(); }
    catch(err){ b.disabled = false; b.textContent = 'Translate';
      box.querySelector('.xl-note')?.remove(); box.insertAdjacentHTML('beforeend', '<small class="xl-note">The free translator isn’t answering (it allows a limited amount a day). Try Google or Claude.</small>'); return; }
  }
  XL.shown.add(k);
  const fresh = document.querySelector(`[data-xl="${k}"]`); if(fresh) fresh.outerHTML = xlateHTML(item.text, item.lang, item.opts);
});

/* ---------- Installable app: keep the app and what it has loaded for use offline ---------- */
if('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')){
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* ---------- Wikipedia links in text, with a preview panel ---------- */
/* Two sources of links, both checked against Wikipedia before use:
   - Wikipedia text: the links that article itself contains (plain-text summaries lose them; this puts them back).
   - AI guide text: the terms the assistant listed with their Wikipedia titles.
   Elements opt in with data-wl="a:<lang>:<article title>" or data-wl="t:<key>" (a term list registered with wlTerms). */
const WL = {links: new Map(), terms: new Map(), pending: new Map(), seen: null};
function wlSeen(){ if(!WL.seen){ try{ WL.seen = JSON.parse(localStorage.getItem('wander.wl') || '{}'); }catch(e){ WL.seen = {}; } } return WL.seen; }
function wlSaveSeen(){ try{ const c = wlSeen(), k = Object.keys(c); for(const x of k.slice(0, Math.max(0, k.length - 1500))) delete c[x]; localStorage.setItem('wander.wl', JSON.stringify(c)); }catch(e){} }
/* Register a guide's term list; returns the key for data-wl="t:<key>" */
function wlTerms(terms){ if(!terms || !terms.length) return ''; const k = 'g' + xlKey('t', JSON.stringify(terms)); WL.terms.set(k, terms); return k; }
const wlUsable = t => t && t.length >= 4 && !/^\d+(s| BC| BCE| AD)?$/.test(t) && !/^(January|February|March|April|May|June|July|August|September|October|November|December) \d+$/.test(t)
  && !/^(List|Lists|Index|Outline|Category|Template|Portal|Help|Wikipedia) /.test(t);
async function wlLoad(spec){
  if(WL.pending.has(spec)) return WL.pending.get(spec);
  const job = (async () => {
    if(spec.startsWith('a:')){
      const [, lang, ...rest] = spec.split(':'), title = rest.join(':');
      const d = await fetchJSON(wikiURL(lang, {action:'query', titles:title, redirects:'1', prop:'links', pllimit:'max', plnamespace:'0'}), 15000);
      const page = d.query && d.query.pages && d.query.pages[0], out = [];
      for(const l of (page && page.links) || []){ const text = l.title.replace(/\s*\([^)]*\)$/, ''); if(wlUsable(text) && text !== title) out.push({text, title: l.title, lang}); }
      WL.links.set(spec, out);
    } else {
      const terms = WL.terms.get(spec.slice(2)) || [], seen = wlSeen(), byLang = {};
      for(const t of terms){ const k = t.lang + '|' + t.title; if(!(k in seen)) (byLang[t.lang] = byLang[t.lang] || []).push(t.title); }
      for(const lang in byLang){
        const titles = [...new Set(byLang[lang])].slice(0, 50);
        const d = await fetchJSON(wikiURL(lang, {action:'query', titles:titles.join('|'), redirects:'1', prop:'pageprops', ppprop:'disambiguation'}), 15000);
        const map = {}; for(const n of [...(d.query?.normalized || []), ...(d.query?.redirects || [])]) map[n.from] = n.to;
        const ok = {}; for(const p of d.query?.pages || []) if(!p.missing && !p.invalid && !(p.pageprops && 'disambiguation' in p.pageprops)) ok[p.title] = true;
        for(const t of titles){ let r = t; for(let i = 0; i < 3 && map[r]; i++) r = map[r]; seen[lang + '|' + t] = ok[r] ? r : ''; }
      }
      wlSaveSeen();
    }
  })().catch(() => { if(spec.startsWith('a:')) WL.links.set(spec, []); }).finally(() => WL.pending.delete(spec));
  WL.pending.set(spec, job); return job;
}
function wlListFor(spec){
  if(spec.startsWith('a:')) return WL.links.has(spec) ? WL.links.get(spec) : null;
  const terms = WL.terms.get(spec.slice(2)); if(!terms) return [];
  const seen = wlSeen(); if(terms.some(t => !((t.lang + '|' + t.title) in seen))) return null;
  return terms.filter(t => seen[t.lang + '|' + t.title]).map(t => ({text: t.text, title: seen[t.lang + '|' + t.title], lang: t.lang}));
}
/* Wrap the first mention of each linkable term inside el (text only; never inside links, buttons or translations) */
function wlLinkIn(el, list, max = 12){
  const isWord = c => !!c && /[\p{L}\p{N}]/u.test(c);
  const cjk = s => /[　-鿿가-힯]/.test(s);
  let made = 0;
  for(const t of [...list].sort((a, b) => b.text.length - a.text.length)){
    if(made >= max) break;
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {acceptNode: n => n.parentElement.closest('a,button,.xl,.wl,script,style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
    for(let n; (n = walk.nextNode());){
      const s = n.nodeValue; let i = s.indexOf(t.text);
      if(i < 0 && !cjk(t.text)){ const j = s.toLowerCase().indexOf(t.text.toLowerCase()); if(j >= 0 && t.text.length >= 8) i = j; }
      if(i < 0) continue;
      if(!cjk(t.text) && (isWord(s[i - 1]) || isWord(s[i + t.text.length]))) continue;   // whole words only
      const a = document.createElement('a');
      a.className = 'wl'; a.href = `https://${t.lang}.wikipedia.org/wiki/${encodeURIComponent(t.title.replace(/ /g, '_'))}`;
      a.dataset.lang = t.lang; a.dataset.title = t.title; a.textContent = s.slice(i, i + t.text.length);
      const rest = n.splitText(i); rest.nodeValue = rest.nodeValue.slice(t.text.length); n.parentNode.insertBefore(a, rest);
      made++; break;
    }
  }
}
/* Link every opted-in element on the page; elements whose links are still loading are linked when they arrive */
function applyWikiLinks(root = document){
  for(const el of root.querySelectorAll('[data-wl]:not([data-wl-done])')){
    const spec = el.dataset.wl, list = wlListFor(spec);
    if(list === null){ wlLoad(spec).then(() => applyWikiLinks(document)); continue; }
    if(list.length) wlLinkIn(el, list);
    el.dataset.wlDone = '1';
  }
}

/* The panel a link opens: the article's summary, then Read on Wikipedia (in the browser) or open it as a place */
(function(){
  const css = document.createElement('style');
  css.textContent = `a.wl{color:inherit;text-decoration:underline;text-decoration-style:dotted;text-decoration-color:var(--brass);text-decoration-thickness:1.5px;text-underline-offset:3px}
.wlp{position:fixed;inset:0;z-index:1200;background:rgba(5,16,17,.5);display:flex;align-items:flex-end;justify-content:center;padding-top:calc(env(safe-area-inset-top) + 12px)}
.wlp[hidden]{display:none}
.wlp-panel{position:relative;width:100%;max-width:560px;max-height:100%;overflow:auto;overscroll-behavior:contain;background:var(--raise);color:var(--ink);border-radius:20px 20px 0 0;box-shadow:var(--shadow);padding-bottom:calc(env(safe-area-inset-bottom) + 18px)}
.wlp-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:12px;padding:16px 16px 10px 20px;background:var(--raise)}
.wlp-head b{flex:1;font:600 21px/1.25 var(--serif)}
.wlp-x{width:38px;height:38px;border-radius:50%;flex:none;display:grid;place-items:center;background:var(--surface);color:var(--ink);border:1px solid var(--rule)}
.wlp-body{padding:0 20px}
.wlp img{display:block;width:100%;max-height:34vh;max-height:34dvh;object-fit:cover;margin-bottom:12px}
.wlp-desc{font-size:13.5px;color:var(--muted);margin:0 0 8px}
.wlp-text{font-size:15.5px;line-height:1.6;margin:0}
.wlp-btns{display:flex;flex-direction:column;gap:8px;margin-top:16px}
.wlp-btns a{display:flex;align-items:center;justify-content:center;height:46px;border-radius:12px;font-weight:500;font-size:15px;text-decoration:none}
.wlp-open{background:var(--brass);color:var(--on-brass)}
.wlp-place{border:1px solid var(--rule);color:var(--ink);background:var(--surface)}
.wlp-src{font-size:12px;color:var(--muted);margin:12px 0 0}
.wlp-load{color:var(--muted);font-size:14px;margin:6px 0 0}`;
  document.head.append(css);
})();
function wlPanel(){
  let p = document.getElementById('wlp'); if(p) return p;
  p = document.createElement('div'); p.id = 'wlp'; p.className = 'wlp'; p.hidden = true;
  p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); p.setAttribute('aria-label', 'Wikipedia article');
  p.innerHTML = `<div class="wlp-panel"><div class="wlp-head"><b id="wlpTitle"></b><button type="button" class="wlp-x" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><div id="wlpContent"></div></div>`;
  document.body.append(p);
  const close = () => { p.hidden = true; document.body.style.overflow = ''; };
  p.addEventListener('click', e => { if(e.target === p || e.target.closest('.wlp-x')) close(); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && !p.hidden) close(); });
  return p;
}
async function openWikiPanel(lang, title){
  const p = wlPanel(), url = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const buttons = qid => `<div class="wlp-btns"><a class="wlp-open" href="${esc(url)}" target="_blank" rel="noopener">Read on Wikipedia ↗</a>`
    + (qid ? `<a class="wlp-place" href="place.html?${esc(new URLSearchParams({id: qid, lang: state.userLang, t: title}).toString())}">Open as a place in Wander</a>` : '') + `</div>`;
  $('#wlpTitle').textContent = title; $('#wlpTitle').lang = lang;
  $('#wlpContent').innerHTML = `<div class="wlp-body"><p class="wlp-load"><span class="spin"></span>Loading…</p>${buttons('')}</div>`;
  p.hidden = false; document.body.style.overflow = 'hidden';
  try{
    const d = await fetchJSON(wikiURL(lang, {action:'query', titles:title, redirects:'1', prop:'extracts|pageimages|pageprops|info', exintro:'1', explaintext:'1',
      piprop:'thumbnail', pithumbsize:'500', ppprop:'wikibase_item|wikibase-shortdesc', inprop:'url'}), 15000);
    const pg = d.query && d.query.pages && d.query.pages[0];
    if(!pg || pg.missing) throw new Error('missing');
    if($('#wlpTitle').textContent !== title) return;   // another link was opened meanwhile
    const pp = pg.pageprops || {}, text = trimText((pg.extract || '').replace(/\n+/g, '\n'), 1100);
    $('#wlpTitle').textContent = pg.title;
    $('#wlpContent').innerHTML = (pg.thumbnail ? `<img alt="" src="${esc(pg.thumbnail.source)}">` : '')
      + `<div class="wlp-body">${pp['wikibase-shortdesc'] ? `<p class="wlp-desc">${esc(cap(pp['wikibase-shortdesc']))}</p>` : ''}`
      + `<p class="wlp-text" lang="${esc(lang)}" style="white-space:pre-line">${esc(text || 'This article has no summary.')}</p>`
      + (text ? xlateHTML(text, lang, {about: pg.title, googleURL: translateLink(lang, pg.title)}) : '')
      + buttons(pp.wikibase_item) + `<p class="wlp-src">From ${esc(langName(lang))} Wikipedia (CC BY-SA)</p></div>`;
  }catch(e){
    $('#wlpContent').innerHTML = `<div class="wlp-body"><p class="wlp-load">Couldn’t load a preview${navigator.onLine === false ? ' while offline' : ''}.</p>${buttons('')}</div>`;
  }
}
document.addEventListener('click', e => {
  const a = e.target.closest('a.wl'); if(!a || e.metaKey || e.ctrlKey) return;
  e.preventDefault(); openWikiPanel(a.dataset.lang, a.dataset.title);
});
