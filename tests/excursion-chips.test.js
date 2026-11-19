// Excursion chips (Hot springs, Fishing) count exactly what the Excursions list shows: after the Wild/Developed filter,
// and a switched-off section is named in the "hidden" note. Live: the NOAA list (bundled) and Wikidata around Burbank.
const {OUT} = require('./paths');
const {chromium} = require('playwright');
const J = (r, body) => r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(body)});
(async () => {
  const srv = await require('./serve.js')(8791); const b = await chromium.launch();
  const ctx = await b.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block'}); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/^https?:\/\//, r => { const h = new URL(r.request().url()).hostname;
    if(/localhost|cdnjs|fonts|query\.wikidata\.org|tile\.openstreetmap|nominatim/.test(h)) return r.continue();
    if(/overpass/.test(h)) return J(r, {elements: []});
    if(h === 'www.wikidata.org') return J(r, {entities: {}});
    if(/wikipedia|wikivoyage|commons/.test(h)) return J(r, {query: {pages: []}});
    return J(r, {}); });
  await pg.goto('http://localhost:8791/index.html'); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('wander.mode', '"nature"'); }); await pg.reload(); await pg.waitForTimeout(300);
  await pg.evaluate(() => setManual(34.18172, -118.31143));
  await pg.waitForFunction(() => state.far.size > 0 && !state.loading, null, {timeout: 90000}); await pg.waitForTimeout(3000);
  const ok = (what, cond) => console.log((cond ? 'ok   ' : 'FAIL ') + what);
  const look = () => pg.evaluate(() => ({chip: (document.querySelector('.legend .g-far[data-src="spring"]') || {}).textContent,
    cards: [...document.querySelectorAll('.card.far .fi.spring')].length, note: (document.querySelector('.hidden-note') || {}).innerText || ''}));
  for(const f of ['all', 'wild', 'dev']){
    await pg.evaluate(f => { state.springFilter = f; render(); }, f); const r = await look();
    console.log(f, JSON.stringify(r)); ok(`filter ${f}: chip count matches the list`, r.chip === 'Hot springs' + r.cards);
  }
  await pg.evaluate(() => { state.springFilter = 'all'; setHiddenSrc(new Set(['spring'])); }); const off = await look();
  console.log('switched off', JSON.stringify(off)); ok('switched-off hot springs are named in the hidden note', off.cards === 0 && /Hot springs/.test(off.note));
  await pg.click('#showAllSrc'); await pg.waitForTimeout(200); ok('Show all brings them back', (await look()).cards > 0);
  // they are their own entries in the Types menu, not chips outside it; Types' Hide all / Show all covers them
  const where = await pg.evaluate(() => ({inTypes: !!document.querySelector('#catMenu [data-src="spring"]'), inRow: !!document.querySelector('.lg-row [data-src="spring"]'), heading: !document.querySelector('.lg-farh').hidden}));
  console.log('placement', JSON.stringify(where)); ok('Hot springs sits inside the Types menu, under Excursions', where.inTypes && !where.inRow && where.heading);
  await pg.click('.lg-catbtn'); await pg.waitForTimeout(150);
  await pg.screenshot({path: OUT + '/types-excursions.png'});
  await pg.click('#catMenu [data-all="cat"]:not([data-show])'); await pg.waitForTimeout(150);
  const hid = await pg.evaluate(() => ({cards: document.querySelectorAll('.card.far').length, dot: !document.querySelector('.lg-catbtn .lg-dot').hidden}));
  await pg.click('#catMenu [data-all="cat"][data-show]'); await pg.waitForTimeout(150);
  const back = await pg.evaluate(() => document.querySelectorAll('.card.far').length);
  ok('Types Hide all hides Excursions too, Show all brings them back', hid.cards === 0 && hid.dot && back > 0);
  console.log('errors', errs); await b.close(); srv.close && srv.close(); process.exit(0);
})();
