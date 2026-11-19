// History mode's earliest peoples: the article's "Earliest peoples" and "The name" sections in the area card,
// names in Indigenous languages from Wikidata (live), Indigenous and ancient site types (live), and the AI guide's original names.
const {OUT} = require('./paths');
const {chromium} = require('playwright');
const J = (r, body) => r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(body)});
const AUCKLAND = `Auckland is a large metropolitan city in the North Island of New Zealand (stand-in).

== Etymology ==
The city was named after George Eden, Earl of Auckland, in 1840. The Māori name for the isthmus is Tāmaki Makaurau, often translated as "Tāmaki desired by many", for its fertile soils and two harbours.

== History ==

=== Early Māori settlement ===
The Auckland isthmus was first settled by Māori around 1350, who valued it for its rich and fertile land. Many pā were built on the volcanic peaks, and by the 1600s the isthmus was home to tens of thousands of people. Ngāti Whātua Ōrākei hold mana whenua here today.

=== Colonial era ===
In 1840 William Hobson chose the site as the new capital of the colony of New Zealand. The capital moved south to Wellington in 1865, to be nearer the middle of the country.

=== Modern ===
The Auckland Harbour Bridge opened in 1959, linking the city with the North Shore. In 2010 the Auckland Council was formed from seven earlier councils.`;
const SAMPLES = {
  // no heading of its own: the history section opens with the first peoples
  burbank: `Burbank is a city (stand-in).\n== History ==\nThe area was originally inhabited by the Tongva people, who lived in villages along the Los Angeles River for thousands of years. Their village of Cahuenga lay a few miles south.\nIn 1797 Mission San Fernando Rey de España was founded nearby, and the land became part of its ranchos.\n== Geography ==\nBurbank lies in the San Fernando Valley.`,
  london: `London is a city (stand-in).\n== Toponymy ==\nLondon is an ancient name, attested already in the first century AD, usually in the Latinised form Londinium. Its origin is uncertain, and many explanations have been put forward.\n== History ==\n=== Prehistory ===\nIn 1993 the remains of a Bronze Age bridge were found on the south foreshore of the Thames. Two of the timbers were radiocarbon dated to between 1750 BC and 1285 BC, and Mesolithic timbers from about 4800 BC lie nearby.\n=== Roman London ===\nThe Romans founded Londinium around AD 47, about four years after the invasion of AD 43.`,
  kyoto: `京都市は日本の都市である。\n== 歴史 ==\n=== 先史 ===\n京都盆地には旧石器時代から人が住み、縄文時代の遺跡も多く見つかっている。弥生時代には稲作の集落が各地に営まれた。\n=== 平安京 ===\n794年に桓武天皇が平安京へ遷都した。`,
  none: `Springfield is a town (stand-in).\n== History ==\nThe town was founded in 1850 by settlers from Ohio, who built a mill by the river.\nThe railroad arrived in 1871 and the town grew quickly after that.`
};
(async () => {
  const srv = await require('./serve.js')(8781); const b = await chromium.launch();
  const ctx = await b.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, serviceWorkers: 'block'}); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/^https?:\/\//, r => { const u = new URL(r.request().url()), h = u.hostname, sp = u.searchParams;
    if(/localhost|cdnjs|fonts|query\.wikidata\.org|tile\.openstreetmap/.test(h)) return r.continue();   // Wikidata SPARQL is live
    if(h === 'nominatim.openstreetmap.org') return J(r, {address: {suburb: 'Auckland Central', city: 'Auckland', country: 'New Zealand', country_code: 'nz'}, extratags: {wikidata: 'Q37100'}});
    if(h === 'www.wikidata.org') return J(r, {entities: {Q37100: {sitelinks: {enwiki: {title: 'Auckland'}}}}});
    if(h === 'en.wikipedia.org'){
      if(sp.get('titles') === 'Auckland' && sp.get('exintro')) return J(r, {query: {pages: [{title: 'Auckland', extract: 'Auckland is a large city in New Zealand (stand-in).', fullurl: 'https://en.wikipedia.org/wiki/Auckland'}]}});
      if(sp.get('titles') === 'Auckland') return J(r, {query: {pages: [{title: 'Auckland', extract: AUCKLAND}]}});
      return J(r, {query: {pages: []}}); }
    if(/wikipedia|wikivoyage|commons/.test(h)) return J(r, {query: {pages: []}});
    if(/overpass/.test(h)) return J(r, {elements: []});
    return J(r, {}); });
  await pg.goto('http://localhost:8781/index.html'); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('wander.radius', '805'); }); await pg.reload(); await pg.waitForTimeout(300);

  // 1. Reading the sections out of article text
  const units = await pg.evaluate(S => Object.fromEntries(Object.entries(S).map(([k, t]) => [k, {early: earlyPeoples(t), name: nameOrigin(t), timeline: timeline(t).map(r => r.label)}])), SAMPLES);
  console.log('sections:', JSON.stringify(units, null, 1));
  const ok = (what, cond) => console.log((cond ? 'ok   ' : 'FAIL ') + what);
  ok('Burbank: first peoples from the opening history paragraph', units.burbank.early && /Tongva/.test(units.burbank.early.text));
  ok('London: prehistory section and toponymy', units.london.early && units.london.early.head === 'Prehistory' && units.london.name && /Londinium/.test(units.london.name.text));
  ok('London: timeline starts in prehistory', units.london.timeline[0] === '4800 BC' || /BC/.test(units.london.timeline[0]));
  ok('Kyoto: 先史 section', units.kyoto.early && units.kyoto.early.head === '先史');
  ok('Springfield: nothing invented', !units.none.early && !units.none.name);

  // 2. The area card (simulated Wikipedia, live Wikidata names)
  await pg.evaluate(() => setManual(-36.8485, 174.7633));
  await pg.waitForFunction(() => !state.loading && state.lastLoadTime > 0, null, {timeout: 90000});
  await pg.waitForFunction(() => state.area[0] && state.area[0].details && !state.area[0].details.loading, null, {timeout: 60000});
  await pg.evaluate(() => { state.expanded.add('area:Q37100'); render(); });
  await pg.waitForTimeout(500);
  const d = await pg.evaluate(() => { const x = state.area[0].details; return {facts: x.facts.map(f => f[0] + ': ' + f[1].replace(/<[^>]+>/g, '')), early: x.early, name: x.name, hist: (x.hist || []).map(h => h.label)}; });
  console.log('area:', JSON.stringify(d, null, 1));
  const card = await pg.evaluate(() => document.querySelector('[data-key="area:Q37100"]').innerText.replace(/\n+/g, ' | '));
  console.log('card:', card.slice(0, 900));
  ok('Name in Māori fact (live Wikidata)', d.facts.some(f => /^Name in Māori: Tāmaki/.test(f)));
  ok('The name and Earliest peoples sections shown', /The name/.test(card) && /Earliest peoples/.test(card) && /settled by Māori around 1350/.test(card));
  ok('Timeline includes Māori settlement, and the card skips repeats', d.hist[0] === '1350' && !/1350 \| The Auckland isthmus/.test(card));
  ok('Section link points at its heading', await pg.evaluate(() => (document.querySelector('.secl[href*="Early_M"]') || {}).href || ''));
  await pg.evaluate(() => document.querySelector('[data-key="area:Q37100"]').scrollIntoView());
  await pg.screenshot({path: OUT + '/indigenous-area.png'});

  // 3. Indigenous and ancient site types (live Wikidata): Auckland's pā and marae, Stanley Park's village site
  const sites = await pg.evaluate(async () => {
    const want = /pā|marae|village site|petroglyph|rock art|midden|earthworks|heiau|kofun|pueblo/i, out = {};
    state.radius = 3000;
    for(const [k, lat, lon] of [['auckland', -36.8770, 174.7650], ['vancouver', 49.3020, -123.1410]]){
      const rows = await fetchWDAround(lat, lon);
      out[k] = [...new Set(rows.filter(r => want.test((r.typeLabel || {}).value || '')).map(r => `${r.itemLabel.value} (${r.typeLabel.value})`))].slice(0, 8);
    }
    state.radius = 805; return out; });
  console.log('sites:', JSON.stringify(sites, null, 1));
  ok('Auckland: pā or marae found', sites.auckland.length > 0);
  ok('Vancouver: village site found', sites.vancouver.some(s => /village site/.test(s)));

  // 4. The AI guide's original names, in the area card and on a place
  const msg = await pg.evaluate(() => importGuide(JSON.stringify({wander: 1, area: {name: 'Auckland Central', lat: -36.8485, lon: 174.7633, indigenousName: 'Tāmaki Makaurau (Māori): Tāmaki desired by many', summary: 'The isthmus has been home to Māori for more than six centuries (stand-in).', keyPoints: ['Pā crowned the volcanic cones.']},
    places: [{id: null, name: 'Maungawhau / Mount Eden', indigenousName: 'Maungawhau (Māori): mountain of the whau tree', kind: 'Pā', lat: -36.8767, lon: 174.7644, summary: 'A volcanic cone terraced as a pā (stand-in).', seeToday: 'Terraces and storage pits on the slopes.'}]})));
  console.log('import:', msg);
  await pg.waitForTimeout(600);
  const g = await pg.evaluate(() => ({stored: loadGuides()[0].area.indigenousName, place: loadGuides()[0].places[0].indigenousName,
    card: document.querySelector('[data-key="area:Q37100"]').innerText.includes('Original name'),
    merged: mergeEntry({name: 'A', indigenousName: 'X'}, {name: 'A', indigenousName: ''}).indigenousName}));
  console.log('guide:', JSON.stringify(g));
  ok('Guide keeps original names and shows them', g.stored && g.place && g.card && g.merged === 'X');
  ok('Prompt asks for indigenousName', await pg.evaluate(() => /indigenousName/.test(guidePrompt(false, 1609))));
  await pg.screenshot({path: OUT + '/indigenous-guide.png'});
  console.log('errors', errs); await b.close(); srv.close && srv.close(); process.exit(0);
})();
