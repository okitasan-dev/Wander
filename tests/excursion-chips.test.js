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
    if(h === 'en.wikipedia.org' && /Sulphur|Beverly/.test(new URL(r.request().url()).searchParams.get('titles') || '')) return J(r, {query: {pages: [   // stand-in article intros
      {title: 'Radium Sulphur Springs', extract: 'Radium Sulphur Springs was a geothermal spa in Los Angeles (stand-in). The bathhouse was demolished in the 1950s.', fullurl: 'https://en.wikipedia.org/wiki/Radium_Sulphur_Springs'},
      {title: 'Beverly Hot Springs', extract: 'Beverly Hot Springs is a spa in Los Angeles fed by an artesian well at 105 °F (41 °C) (stand-in).', fullurl: 'https://en.wikipedia.org/wiki/Beverly_Hot_Springs'}]}});
    if(/wikipedia|wikivoyage|commons/.test(h)) return J(r, {query: {pages: []}});
    return J(r, {}); });
  await pg.goto('http://localhost:8791/index.html'); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('wander.mode', '"nature"'); }); await pg.reload(); await pg.waitForTimeout(300);
  await pg.evaluate(() => setManual(34.18172, -118.31143));
  await pg.waitForFunction(() => state.far.size > 0 && !state.loading, null, {timeout: 90000}); await pg.waitForTimeout(3000);
  const ok = (what, cond) => console.log((cond ? 'ok   ' : 'FAIL ') + what);
  const look = () => pg.evaluate(() => ({chip: (document.querySelector('.legend .g-far[data-src="spring"]') || {}).textContent,
    cards: [...document.querySelectorAll('.card.far .fi.spring')].length, note: (document.querySelector('.hidden-note') || {}).innerText || ''}));
  // temperature and closed / historic flags
  const sp = await pg.evaluate(() => [...state.far.values()].filter(x => x.topic === 'spring').map(x => ({name: x.name, tempF: x.tempF, status: x.status || '', note: x.statusNote || ''})));
  console.log('springs', JSON.stringify(sp));
  const by = n => sp.find(x => x.name === n) || {};
  ok('Radium Sulphur Springs flagged Closed, with the sentence', by('Radium Sulphur Springs').status === 'closed' && /demolished/.test(by('Radium Sulphur Springs').note));
  ok('Beverly Hot Springs: temperature from its article, not closed', by('Beverly Hot Springs').tempF === 105 && by('Beverly Hot Springs').status !== 'closed');
  ok('El Encino keeps its NOAA temperature', by('El Encino Springs').tempF === 79);
  const unit = await pg.evaluate(() => { const a = {}, b = {}, c = {}, d = {};
    springFromText(a, 'Foo Springs is a resort. It closed in 2020 for renovation and reopened in 2022.');
    springFromText(b, 'Bar Hot Springs is a historic bathhouse built in 1910.');
    springFromText(c, 'Baz Spring was an early resort on the river. Guests came by stagecoach.');
    springFromText(d, 'Qux Hot Springs is a natural pool. The water is 38 °C.');
    return [a.status || '', b.status || '', c.status || '', d.tempF]; });
  console.log('unit', JSON.stringify(unit));
  ok('reopened is not closed; "historic" and "was a…" mark historic sites; °C converts', unit[0] === '' && unit[1] === 'historic' && unit[2] === 'historic' && unit[3] === 100);
  const card = await pg.evaluate(() => { const c = [...document.querySelectorAll('.card.far')].find(c => /Radium/.test(c.innerText)); return c ? c.innerText.replace(/\n+/g, ' | ') : ''; });
  console.log('card:', card); ok('card shows the Closed tag and why, once', /Closed/.test(card) && (card.match(/demolished/g) || []).length === 1);
  await pg.evaluate(() => { const h = [...document.querySelectorAll('h2.band b')].find(b => b.textContent === 'Excursions'); h && h.scrollIntoView(); });
  await pg.screenshot({path: OUT + '/springs-status.png'});
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
