// AI guide places show out to 6 mi (the guide's Town distance, 5 mi, plus one) from you, whatever the search radius, in a section of their own
// past the radius; anything farther stays hidden (another town's guide too); the AI guide's Area has a 3 mi choice.
const {OUT} = require('./paths');
const {chromium} = require('playwright');
const J = (r, body) => r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(body)});
const C = {lat: 34.1808, lon: -118.3090};   // Burbank
const at = (km, deg) => ({lat: C.lat + km / 111 * Math.cos(deg * Math.PI / 180), lon: C.lon + km / 92 * Math.sin(deg * Math.PI / 180)});
const P = (name, km, deg) => ({name, kind: 'Building', ...at(km, deg), summary: name + ' (stand-in).', confidence: 'high', located: 'GPS survey'});
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, serviceWorkers: 'block'});
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/^https?:\/\//, r => { const u = new URL(r.request().url()), h = u.hostname;
    if(/cdnjs|fonts/.test(h)) return r.continue();
    if(h === 'nominatim.openstreetmap.org') return J(r, u.pathname === '/search' ? [] : {name: 'Burbank', addresstype: 'city', address: {city: 'Burbank', country: 'United States', country_code: 'us'}, extratags: {}});
    if(h === 'query.wikidata.org') return J(r, {results: {bindings: []}});
    return r.abort(); });
  await pg.goto('file://' + require('path').resolve(__dirname, '..') + '/index.html'); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('wander.radius', '805'); }); await pg.reload(); await pg.waitForTimeout(400);
  let fails = 0; const ok = (t, c) => { console.log((c ? 'ok   ' : 'FAIL ') + t); if(!c) fails++; };

  // the AI guide sheet: a 3 mi Area, and the prompt says so
  const area = await pg.evaluate(() => [...document.querySelectorAll('input[name="gRadius"]')].map(r => r.parentElement.textContent.trim()));
  console.log('AI guide Area:', area.join(' · '));
  ok('AI guide Area has 3 mi between 2 mi and Town', area.join('|') === '¼ mi|½ mi|1 mi|2 mi|3 mi|Town');
  await pg.evaluate(() => setManual(34.1808, -118.3090)); await pg.waitForTimeout(1500);
  const pr = await pg.evaluate(() => guidePrompt(false, 4828));
  ok('the 3 mi prompt asks for about 3 mi (4828 m)', /within about 3 mi \(4828 m\)/.test(pr));

  // a town-wide guide for Burbank, and one for Kyoto
  const guide = (name, c, places) => JSON.stringify({wander: 1, area: {name, lat: c.lat, lon: c.lon, summary: 'Stand-in.'}, places});
  await pg.evaluate(t => importGuide(t), guide('Burbank', C, [P('Near place', .3, 0), P('Three km place', 3, 90), P('Six km place', 6, 200), P('Ten km place', 10, 120)]));
  await pg.evaluate(t => importGuide(t), guide('Kyoto', {lat: 35.0037, lon: 135.7788}, [{name: 'Kyoto place', kind: 'Temple', lat: 35.004, lon: 135.779, summary: 'x', confidence: 'high'}]));
  await pg.evaluate(() => { document.querySelectorAll('details.sheet').forEach(x => x.open = false); render(); }); await pg.waitForTimeout(300);
  const look = () => pg.evaluate(() => ({cards: [...document.querySelectorAll('#listWrap article[data-key] h3')].map(h => h.textContent.replace(/^\d+/, '').trim()),
    bands: [...document.querySelectorAll('#listWrap h2.band')].map(h => h.textContent.trim()), pins: M.pins.size}));
  let s = await look(); console.log('in Burbank, radius ½ mi:', JSON.stringify(s));
  ok('guide places out to 6 mi show, also 3 and 6 km away, with a ½ mi radius', ['Near place', 'Three km place', 'Six km place'].every(n => s.cards.includes(n)) && s.pins === 3);
  ok('a guide place 10 km away stays hidden', !s.cards.includes('Ten km place'));
  ok('…the far ones under "From your AI guide · beyond ½ mi, up to 6 mi"', s.bands.some(b => /^From your AI guide\s*beyond ½ mi, up to 6 mi · 2 places$/.test(b)));
  ok('another town\'s guide stays out', !s.cards.includes('Kyoto place'));
  await pg.evaluate(() => document.querySelector('#listWrap h2.band:last-of-type').scrollIntoView({block: 'start'}));
  await pg.screenshot({path: OUT + '/guide-reach.png'});

  // looking around from elsewhere inside the guide's area, then from well outside it
  await pg.evaluate(c => setManual(c.lat, c.lon), at(4, 300)); await pg.waitForTimeout(1500);
  s = await look(); const want = await pg.evaluate(() => [...state.items.values()].filter(it => it.ai && hav(state.pos, it) <= 9656).map(it => Object.values(it.versions)[0].title).sort());
  console.log('4 km away:', JSON.stringify(s.cards), '| within 6 mi:', JSON.stringify(want));
  ok('from somewhere else, exactly the guide places within 6 mi show', JSON.stringify(s.cards.slice().sort()) === JSON.stringify(want) && want.length >= 2 && want.length < 4);
  await pg.evaluate(c => setManual(c.lat, c.lon), at(25, 0)); await pg.waitForTimeout(1500);
  s = await look(); console.log('25 km away:', JSON.stringify(s.cards));
  ok('25 km away, none show', !s.cards.some(n => /place$/.test(n)));
  console.log(fails ? 'FAIL' : 'PASS'); console.log('errors', errs); await b.close(); process.exit(fails ? 1 : 0);
})();
