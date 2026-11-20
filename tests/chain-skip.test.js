// History mode skips Wikipedia articles about chains and companies (pinned to a branch or a head office), unless they are
// listed heritage, or the intro says this is the first/original location here or a historic building. Live Wikidata types.
const {chromium} = require('playwright');
const J = (r, body) => r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(body)});
// [QID, title, stand-in intro, should it be kept?]
const CASES = [
  ['Q16198409', 'Acapulco Mexican Restaurant and Cantina', 'Acapulco is a chain of Mexican restaurants founded in 1960.', false],
  ['Q1205312', 'In-N-Out Burger', 'In-N-Out Burger is a fast food restaurant chain founded in Baldwin Park in 1948.', false],
  ['Q37158', 'Starbucks', 'Starbucks is a coffeehouse chain.', false],
  ['Q797154', 'El Torito', 'El Torito is a Mexican restaurant chain.', false],
  ['Q7102588', "Original Tommy's", "Original Tommy's is a fast food chain. The original stand in Glendale opened in 1946.", true],   // first location here
  ['Q16198409', 'Acapulco (historic branch)', 'The branch occupies a historic building from 1925.', true],                         // historic building
  ['Q1453665', "Pink's Hot Dogs", "Pink's is a hot dog stand in Hollywood.", true],      // a single restaurant
  ['Q3309185', "Philippe's", "Philippe's is a restaurant in Los Angeles.", true],
  ['Q4931577', "Bob's Big Boy", "Bob's Big Boy is a restaurant in Burbank.", true],       // restaurant and building
  ['Q7676074', "Tail o' the Pup", 'A hot dog stand shaped like a hot dog.', true],
];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block'});
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/^https?:\/\//, r => { const u = new URL(r.request().url()), h = u.hostname;
    if(/cdnjs|fonts|query\.wikidata\.org/.test(h)) return /query\.wikidata/.test(h) && !/chainT/.test(u.searchParams.get('query') || '') ? J(r, {results: {bindings: []}}) : r.continue();
    if(h === 'nominatim.openstreetmap.org') return J(r, {name: 'Glendale', addresstype: 'city', address: {city: 'Glendale', country: 'United States', country_code: 'us'}, extratags: {}});
    return r.abort(); });
  await pg.goto('file://' + require('path').resolve(__dirname, '..') + '/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  let fails = 0; const ok = (t, c) => { console.log((c ? 'ok   ' : 'FAIL ') + t); if(!c) fails++; };
  await pg.evaluate(() => setManual(34.15984, -118.26346)); await pg.waitForTimeout(2000);
  const t0 = Date.now();
  const got = await pg.evaluate(async C => {
    state.items.clear();
    C.forEach(([q, title, extract], i) => state.items.set('k' + i, {key: 'k' + i, qid: q, lat: 34.1590 + i * .0002, lon: -118.2634, versions: {en: {title, extract, url: '#'}}}));
    await loadFacts(); render();
    return {shown: [...document.querySelectorAll('#listWrap article[data-key] h3')].map(h => h.textContent.trim()), pins: M.pins.size};
  }, CASES);
  console.log(`loadFacts took ${Date.now() - t0} ms; shown:`, got.shown.join(' · '));
  for(const [, title, , keep] of CASES) ok(`${keep ? 'kept   ' : 'skipped'} ${title}`, got.shown.some(s => s.includes(title)) === keep);
  ok('pins match the list', got.pins === got.shown.length);
  console.log(fails ? 'FAIL' : 'PASS'); console.log('errors', errs); await b.close(); process.exit(fails ? 1 : 0);
})();
