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
  // organizations, agencies and tournaments are not places either; places that are also run by a nonprofit stay
  ['Q214126', 'Los Angeles Police Department', 'The LAPD is the police department of Los Angeles.', false],
  ['Q1512334', 'Onassis Foundation', 'A cultural foundation.', false],
  ['Q54958878', 'Hugel-JTBC LA Open', 'A women\'s golf tournament.', false],
  ['Q981112', 'Los Angeles Music Center', 'A performing arts complex.', true],
  ['Q6682231', 'Los Angeles LGBT Center', 'A community center.', true],
  ['Q3328437', 'Museum of Neon Art', 'An art museum in Glendale.', true],
  ['Q1624932', 'Hollywood Forever Cemetery', 'A cemetery in Hollywood.', true],
];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block'});
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/^https?:\/\//, r => { const u = new URL(r.request().url()), h = u.hostname;
    if(/cdnjs|fonts|query\.wikidata\.org/.test(h)) return /query\.wikidata/.test(h) && !/[?]listed/.test(u.searchParams.get('query') || '') ? J(r, {results: {bindings: []}}) : r.continue();
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

  // reopening: a card saved before the chain check existed (facts already loaded) is checked straight away, without a new search
  await pg.evaluate(() => {
    state.items.clear(); state.items.set('Q16198409', {key: 'Q16198409', qid: 'Q16198409', lat: 34.1571, lon: -118.2639, factsLoaded: true,
      versions: {en: {title: 'Acapulco Mexican Restaurant and Cantina', extract: 'A chain founded in Pasadena in 1960.', url: '#'}}, facts: []});
    state.lastLoad = {...state.pos}; state.lastLoadTime = Date.now(); render(); saveSession(); });
  const before = await pg.evaluate(() => JSON.parse(localStorage.getItem('wander.session')).items.map(i => i.key));
  await pg.reload(); await pg.waitForTimeout(400);
  const atOnce = await pg.evaluate(() => [...document.querySelectorAll('#listWrap article[data-key] h3')].map(h => h.textContent.trim()));
  await pg.waitForFunction(() => !document.querySelector('#listWrap article[data-key="Q16198409"]'), null, {timeout: 20000}).catch(() => {});
  const after = await pg.evaluate(() => ({shown: [...document.querySelectorAll('#listWrap article[data-key] h3')].map(h => h.textContent.trim()), searched: state.loads}));
  console.log('saved:', before, '| on reopening:', atOnce, '| a moment later:', JSON.stringify(after));
  ok('a card saved from an earlier visit is checked on reopening, with no new search', before.includes('Q16198409') && !after.shown.some(s => /Acapulco/.test(s)) && !after.searched);

  // a busy area: the chain is the 46th card, past the first query's 40
  const busy = await pg.evaluate(async () => {
    state.items.clear();
    for(let i = 0; i < 45; i++) state.items.set('b' + i, {key: 'b' + i, qid: 'Q' + (1000 + i), lat: 34.1598 + i * .00005, lon: -118.2635, versions: {en: {title: 'Place ' + i, extract: '', url: '#'}}});
    state.items.set('Q16198409', {key: 'Q16198409', qid: 'Q16198409', lat: 34.1571, lon: -118.2639, versions: {en: {title: 'Acapulco Mexican Restaurant and Cantina', extract: 'A chain founded in Pasadena in 1960.', url: '#'}}});
    await loadFacts(); return {acapulco: !!state.items.get('Q16198409').chain, checked: [...state.items.values()].filter(it => it.chainChecked).length};
  });
  console.log('busy area:', JSON.stringify(busy));
  ok('every card is checked, not just the first 40', busy.acapulco && busy.checked === 46);

  // a whole search, as on a phone with a slow Overpass: the Acapulco card is never shown, not even for a moment
  await ctx.close();
  const ctx2 = await b.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block'}); const p2 = await ctx2.newPage(); p2.on('pageerror', e => errs.push(e.message));
  await p2.route(/^https?:\/\//, async r => { const u = new URL(r.request().url()), h = u.hostname, sp = u.searchParams;
    if(/cdnjs|fonts|query\.wikidata\.org/.test(h)) return r.continue();
    if(h === 'nominatim.openstreetmap.org') return J(r, {name: 'Glendale', addresstype: 'city', address: {city: 'Glendale', country: 'United States', country_code: 'us'}, extratags: {}});
    if(h === 'en.wikipedia.org' && sp.get('generator') === 'geosearch') return J(r, {query: {pages: [
      {pageid: 1, title: 'Acapulco Mexican Restaurant and Cantina', extract: 'A chain founded in Pasadena in 1960.', fullurl: '#', coordinates: [{lat: 34.1571, lon: -118.26389}], pageprops: {wikibase_item: 'Q16198409'}},
      {pageid: 2, title: 'Alex Theatre', extract: 'A theatre in Glendale.', fullurl: '#', coordinates: [{lat: 34.1575, lon: -118.2610}], pageprops: {wikibase_item: 'Q4717884'}}]}});
    if(/overpass/.test(h)){ await new Promise(res => setTimeout(res, 12000)); return J(r, {elements: []}); }
    if(/wikipedia|wikivoyage|wikimedia/.test(h)) return J(r, {query: {pages: []}});
    return r.abort(); });
  await p2.goto('file://' + require('path').resolve(__dirname, '..') + '/index.html'); await p2.evaluate(() => localStorage.clear()); await p2.reload(); await p2.waitForTimeout(300);
  await p2.evaluate(() => setManual(34.15984, -118.26346));
  let seen = false, alex = false, end = 0;
  for(let i = 0; i < 80; i++){ const st = await p2.evaluate(() => ({aca: !!document.querySelector('#listWrap article[data-key="Q16198409"]'), alex: !!document.querySelector('#listWrap article[data-key="Q4717884"]'), loading: state.loading}));
    seen = seen || st.aca; alex = alex || st.alex; if(!st.loading && i > 3 && !end) end = i; if(end && i > end + 6) break; await p2.waitForTimeout(250); }
  console.log('whole search: Acapulco ever shown:', seen, '| Alex Theatre shown:', alex);
  ok('during a slow search the chain is never shown, real places are', !seen && alex);
  console.log(fails ? 'FAIL' : 'PASS'); console.log('errors', errs); await b.close(); process.exit(fails ? 1 : 0);
})();
