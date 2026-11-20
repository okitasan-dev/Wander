// Names from Wikidata ("Where … died", "Architect", …) become links to their Wikipedia articles after one small lookup.
const {OUT} = require('./paths');
const {chromium} = require('playwright');
const J = (r, body) => r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(body)});
const B = (q, l) => ({x: {type: 'uri', value: 'http://www.wikidata.org/entity/' + q}, xLabel: {type: 'literal', value: l}});
// what the factoid and fact queries return for Cedars-Sinai (trimmed from live answers)
const FACTOIDS = [{rel: {value: 'died'}, ...B('Q181900', 'Stan Lee'), links: {value: '90'}}, {rel: {value: 'died'}, ...B('Q103846', 'Groucho Marx'), links: {value: '80'}},
  {rel: {value: 'died'}, ...B('Q2054', 'Nobody Notable'), links: {value: '1'}}];
const ARTICLES = {Q181900: 'https://en.wikipedia.org/wiki/Stan_Lee', Q103846: 'https://en.wikipedia.org/wiki/Groucho_Marx', Q193: 'https://en.wikipedia.org/wiki/Cedars_of_God'};
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, serviceWorkers: 'block'});
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); const lookups = [];
  await pg.route(/^https?:\/\//, r => { const u = new URL(r.request().url()), h = u.hostname;
    if(/cdnjs|fonts/.test(h)) return r.continue();
    if(h === 'query.wikidata.org'){ const q = u.searchParams.get('query') || '';
      if(/schema:about/.test(q)){ const ids = [...q.matchAll(/wd:(Q\d+)/g)].map(m => m[1]); lookups.push(ids);
        return J(r, {results: {bindings: ids.map(id => ({x: {type: 'uri', value: 'http://www.wikidata.org/entity/' + id}, ...(ARTICLES[id] ? {e: {type: 'uri', value: ARTICLES[id]}} : {})}))}}); }
      return J(r, {results: {bindings: []}}); }
    if(h === 'nominatim.openstreetmap.org') return J(r, {name: 'Beverly Grove', addresstype: 'suburb', address: {suburb: 'Beverly Grove', city: 'Los Angeles', country: 'United States', country_code: 'us'}, extratags: {}});
    if(h === 'en.wikipedia.org' && /Stan_Lee|Stan%20Lee/.test(u.href)) return J(r, {title: 'Stan Lee', extract: 'Stan Lee was an American comic book writer. (stand-in)', description: 'American comic book writer'});
    return r.abort(); });
  await pg.goto('file://' + require('path').resolve(__dirname, '..') + '/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  let fails = 0; const ok = (t, c) => { console.log((c ? 'ok   ' : 'FAIL ') + t); if(!c) fails++; };
  await pg.evaluate(() => setManual(34.0754, -118.3804)); await pg.waitForTimeout(2000);
  await pg.evaluate(([F]) => {
    const m = {facts: [], events: []};
    placeFacts([{kind: {value: 'v'}, pid: {value: 'http://www.wikidata.org/entity/P138'}, val: {value: 'http://www.wikidata.org/entity/Q193'}, valLabel: {value: 'Cedars of God'}},
                {kind: {value: 'v'}, pid: {value: 'http://www.wikidata.org/entity/P112'}, val: {value: 'http://www.wikidata.org/entity/Q2055'}, valLabel: {value: 'Hebrew Benevolent Society'}}], m);
    state.area = [{key: 'area:Q1052562', qid: 'Q1052562', versions: {en: {title: 'Cedars-Sinai Medical Center', extract: 'A hospital. (stand-in)', url: '#'}},
      details: {facts: m.facts, factoids: factoidList(F, 'Cedars-Sinai Medical Center')}}];
    state.expanded.add('area:Q1052562'); render(); }, [FACTOIDS]);
  await pg.waitForTimeout(800);
  const r = await pg.evaluate(() => { const c = document.querySelector('#areaWrap article[data-key="area:Q1052562"]');
    return {died: c.querySelector('.factoids li').innerHTML, links: [...c.querySelectorAll('a.wl')].map(a => `${a.textContent} → ${a.dataset.lang}:${a.dataset.title}`),
      plain: [...c.querySelectorAll('span.wdn')].map(s => s.textContent + (s.dataset.q ? ' (waiting)' : '')), facts: [...c.querySelectorAll('.factgrid dd')].map(d => d.innerHTML)}; });
  console.log(JSON.stringify(r, null, 1)); console.log('lookups', JSON.stringify(lookups));
  ok('people who died here link to their articles', r.links.includes('Stan Lee → en:Stan Lee') && r.links.includes('Groucho Marx → en:Groucho Marx'));
  ok('a name without an article stays plain text', r.plain.includes('Nobody Notable') && !r.links.some(l => /Nobody/.test(l)));
  ok('fact grid names link too (Named after), others stay plain', r.links.includes('Cedars of God → en:Cedars of God') && r.plain.includes('Hebrew Benevolent Society'));
  ok('one lookup for all the names', lookups.length === 1 && lookups[0].length === 5);
  await pg.evaluate(() => render()); await pg.waitForTimeout(300);
  ok('a redraw links straight from memory, no new lookup', lookups.length === 1 && await pg.evaluate(() => document.querySelectorAll('#areaWrap a.wl').length) === 3);
  await pg.evaluate(() => document.querySelector('#areaWrap .factoids').scrollIntoView({block: 'center'}));
  await pg.screenshot({path: OUT + '/wikidata-links.png'});
  await pg.click('#areaWrap a.wl[data-title="Stan Lee"]'); await pg.waitForTimeout(800);
  const panel = await pg.evaluate(() => { const p = document.querySelector('.wlp'); return p && !p.hidden ? p.innerText.slice(0, 120) : null; });
  console.log('panel:', JSON.stringify(panel));
  ok('tapping a name opens the article panel', !!panel && /Stan Lee/.test(panel));
  console.log(fails ? 'FAIL' : 'PASS'); console.log('errors', errs); await b.close(); process.exit(fails ? 1 : 0);
})();
