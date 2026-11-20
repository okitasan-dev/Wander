// AI guides sent in parts: the prompts ask for parts of 8 places (12 for town-wide guides); pasting the parts one by one,
// or all at once, builds one guide; a cut-off last part keeps what arrived; a single block works as before.
const {chromium} = require('playwright');
const J = (r, body) => r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(body)});
const P = (name, i) => ({name, kind: 'Building', lat: 34.1817 + i * .0005, lon: -118.3089, summary: `${name} (stand-in).`, confidence: 'medium'});
const AREA = {name: 'Downtown Burbank', lat: 34.1808, lon: -118.3090, summary: 'The old town centre (stand-in).', keyPoints: ['Founded 1887.']};
const ONLY = {name: 'Downtown Burbank', lat: 34.1808, lon: -118.3090};
const part = (n, of, places, area = n === 1 ? AREA : ONLY) => ({wander: 1, part: n, parts: of, area, places});
const block = o => 'Here is part.\n```json\n' + JSON.stringify(o, null, 1) + '\n```\n';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block'});
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/^https?:\/\//, r => { const h = new URL(r.request().url()).hostname;
    if(/cdnjs|fonts/.test(h)) return r.continue();
    if(h === 'nominatim.openstreetmap.org') return J(r, /search/.test(r.request().url()) ? [] : {name: 'Burbank', addresstype: 'city', address: {city: 'Burbank', country: 'United States', country_code: 'us'}, extratags: {}});
    if(h === 'query.wikidata.org') return J(r, {results: {bindings: []}});
    return r.abort(); });
  await pg.goto('file://' + require('path').resolve(__dirname, '..') + '/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  let fails = 0; const ok = (t, c) => { console.log((c ? 'ok   ' : 'FAIL ') + t); if(!c) fails++; };
  await pg.evaluate(() => setManual(34.1808, -118.3090)); await pg.waitForTimeout(1500);

  // the prompts
  const pr = await pg.evaluate(() => ({hist: guidePrompt(false, 1609), town: guidePrompt(false, 8047), far: farPrompt('springs', false, 40234), nat: (state.mode = 'nature', guidePrompt(false, 1609))}));
  await pg.evaluate(() => { state.mode = 'history'; });
  for(const [k, t] of Object.entries(pr)) console.log(k, '→', (t.match(/Part 1 has[^\n]*/) || ['(none)'])[0].slice(0, 140));
  ok('every prompt asks for parts of 8 places', ['hist', 'far', 'nat'].every(k => /the first 8 places/.test(pr[k]) && /Reply "next" for part N of M/.test(pr[k]) && /\{"wander":1,"part":1,"parts":1/.test(pr[k])));
  ok('town-wide guides: 12 a part', /the first 12 places/.test(pr.town));
  ok('no prompt still asks for a single block', !Object.values(pr).some(t => /a single ```json/.test(t)));

  // one part at a time
  const imp = t => pg.evaluate(t => importGuide(t), t);
  const one = await imp(block(part(1, 3, [P('Old Town Hall', 0), P('Bank of Burbank', 1)])));
  const two = await imp(block(part(2, 3, [P('Fire Station 1', 2), P('Old Town Hall', 0)])));
  const three = await imp(block(part(3, 3, [P('Movie palace', 3)])));
  console.log(' 1:', one); console.log(' 2:', two); console.log(' 3:', three);
  let g = await pg.evaluate(() => loadGuides());
  ok('part 1 says what to do next', /Part 1 of 3 added \(2 places so far for Downtown Burbank\)\. Reply “next” in the chat for part 2/.test(one));
  ok('part 2 lists parts so far', /Parts 1, 2 of 3 added \(3 places so far/.test(two));
  ok('part 3 says all in', /All 3 parts added: 4 places for Downtown Burbank\./.test(three));
  ok('one guide, counted once, the area text kept, the repeated place merged', g.length === 1 && (g[0].count || 1) === 1 && g[0].places.length === 4 && /old town centre/.test(g[0].area.summary));
  await pg.evaluate(id => guideStartFresh(id), g[0].id);
  g = await pg.evaluate(() => loadGuides());
  ok('"keep only the newest" keeps every part of it', g[0].places.length === 4 && /old town centre/.test(g[0].area.summary));

  // the whole chat at once, last part cut off
  await pg.evaluate(() => localStorage.removeItem('wander.guides'));
  const chat = 'I researched the area.\n' + block(part(1, 3, [P('Old Town Hall', 0), P('Bank of Burbank', 1)])) + 'Reply "next" for part 2 of 3.\nnext\n'
    + block(part(2, 3, [P('Fire Station 1', 2)])) + 'Reply "next" for part 3 of 3.\nnext\n' + block(part(3, 3, [P('Movie palace', 3), P('Cut short', 4)])).slice(0, -120);
  const all = await imp(chat); console.log(' chat:', all);
  g = await pg.evaluate(() => loadGuides());
  ok('a whole chat pasted at once: one guide with every complete place', g.length === 1 && g[0].places.length === 4 && g[0].places.some(p => p.name === 'Movie palace') && !g[0].places.some(p => p.name === 'Cut short'));
  ok('…and the message says which part was cut off', /^Part 3 was cut off, so only the 1 place that arrived complete was kept. All 3 parts added: 4 places/.test(all));

  // the old single-block reply still works
  await pg.evaluate(() => localStorage.removeItem('wander.guides'));
  const single = await imp(block({wander: 1, area: AREA, places: [P('Old Town Hall', 0), P('Bank of Burbank', 1)]}));
  console.log(' single:', single);
  ok('a single block (no parts) reads as before', /^Added 2 places for Downtown Burbank\.$/.test(single));
  console.log(fails ? 'FAIL' : 'PASS'); console.log('errors', errs); await b.close(); process.exit(fails ? 1 : 0);
})();
