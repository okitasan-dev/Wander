// History "About this area": the closest area first (hamlet, then town), the county last under "Wider area".
const {OUT} = require('./paths');
const {chromium} = require('playwright');
const J = (r, body) => r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(body)});
// Real Nominatim answers near Lake Arrowhead (Nov 2026), trimmed
const ADDR = {hamlet: 'Crest Park', town: 'Lake Arrowhead', county: 'San Bernardino County', state: 'California', 'ISO3166-2-lvl4': 'US-CA', country: 'United States', country_code: 'us'};
const SPOTS = {
  crest: {14: {name: 'Crest Park', addresstype: 'hamlet', osm_type: 'node', osm_id: 1, address: ADDR, extratags: {wikidata: 'Q5184552'}}},
  north: {14: {name: 'North Shore', addresstype: 'hamlet', osm_type: 'node', osm_id: 2, address: {...ADDR, hamlet: 'North Shore'}, extratags: {}}},
  burbank: {14: {name: 'Burbank', addresstype: 'city', osm_type: 'relation', osm_id: 3, address: {city: 'Burbank', county: 'Los Angeles County', country: 'United States', country_code: 'us'}, extratags: {wikidata: 'Q39561'}},
            10: {name: 'Burbank', addresstype: 'city', extratags: {wikidata: 'Q39561'}}},
};
const LEVELS = {12: {name: 'Lake Arrowhead', addresstype: 'town', extratags: {wikidata: 'Q979424'}}, 10: {name: 'San Bernardino County', addresstype: 'county', extratags: {wikidata: 'Q108053'}}};
const TITLES = {Q5184552: 'Crest Park, California', Q979424: 'Lake Arrowhead, California', Q108053: 'San Bernardino County, California', Q39561: 'Burbank, California'};
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, serviceWorkers: 'block'});
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  let spot = 'crest'; const zooms = [];
  await pg.route(/^https?:\/\//, r => { const u = new URL(r.request().url()), h = u.hostname, sp = u.searchParams;
    if(/cdnjs|fonts/.test(h)) return r.continue();
    if(h === 'nominatim.openstreetmap.org'){ const z = sp.get('zoom'); zooms.push(spot + ':' + z); return J(r, SPOTS[spot][z] || LEVELS[z] || {}); }
    if(h === 'www.wikidata.org') return J(r, {entities: Object.fromEntries(sp.get('ids').split('|').map(q => [q, {sitelinks: {enwiki: {title: TITLES[q]}}}]))});
    if(/wikipedia\.org$/.test(h) && sp.get('titles')) return J(r, {query: {pages: sp.get('titles').split('|').map(t => ({title: t, extract: `${t} is a place in California. (stand-in text)`, fullurl: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(t)}))}});
    if(/wikipedia\.org$/.test(h)) return J(r, {query: {pages: []}});
    if(h === 'query.wikidata.org') return J(r, {results: {bindings: []}});
    return r.abort(); });
  await pg.goto('file://' + require('path').resolve(__dirname, '..') + '/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  const look = () => pg.evaluate(() => ({labels: [...document.querySelectorAll('#areaWrap .area-lvl')].map(x => x.textContent),
    cards: [...document.querySelectorAll('#areaWrap .card.area h3')].map(x => x.textContent.trim() + ' ' + getComputedStyle(x).fontSize)}));
  let fails = 0; const ok = (t, c) => { console.log((c ? 'ok   ' : 'FAIL ') + t); if(!c) fails++; };

  await pg.evaluate(() => setManual(34.2483, -117.1890)); await pg.waitForTimeout(5000);
  let r = await look(); console.log('Crest Park:', JSON.stringify(r), zooms.join(' '));
  ok('hamlet, town, then county', r.cards.length === 3 && /^Crest Park/.test(r.cards[0]) && /^Lake Arrowhead/.test(r.cards[1]) && /^San Bernardino/.test(r.cards[2]));
  ok('two sections', r.labels.join('|') === 'Right here|Wider area');
  ok('smaller headings', r.cards.every(c => / 23px$/.test(c)));
  await pg.evaluate(() => document.querySelector('#areaWrap').scrollIntoView());
  await pg.screenshot({path: OUT + '/area-levels.png'});

  spot = 'north'; zooms.length = 0;
  await pg.evaluate(() => setManual(34.2560, -117.1900)); await pg.waitForTimeout(5000);
  r = await look(); console.log('North Shore:', JSON.stringify(r));
  ok('no article for the hamlet: town first, county wider', r.cards.length === 2 && /^Lake Arrowhead/.test(r.cards[0]) && /^San Bernardino/.test(r.cards[1]) && r.labels.join('|') === 'Right here|Wider area');

  spot = 'burbank'; zooms.length = 0;
  await pg.evaluate(() => setManual(34.18172, -118.31143)); await pg.waitForTimeout(4000);
  r = await look(); console.log('Burbank:', JSON.stringify(r), zooms.join(' '));
  ok('a city: one card, no section labels, no extra zoom-12 lookup', r.cards.length === 1 && !r.labels.length && !zooms.includes('burbank:12'));
  ok('places list still loads', await pg.evaluate(() => !state.loading));
  console.log(fails ? 'FAIL' : 'PASS'); console.log('errors', errs); await b.close(); process.exit(fails ? 1 : 0);
})();
