// Categories: what each place is (pin colour, chips under the map), and the Sources menu
const {ROOT, OUT} = require('./paths');
const {chromium} = require('playwright');
const H = [   // [expected category, item]
  ['relig', {facts: ['Church building', 'Grade I listed building'], title: 'St Mary'}],
  ['indig', {facts: ['Scheduled monument'], title: 'Bowl barrow 300m south of Manor Farm'}],
  ['bldg', {facts: ['Scheduled monument'], title: 'Castle Rushen'}],
  ['bldg', {facts: ['Grade II* listed building'], title: 'The George'}],
  ['monu', {tags: {historic: 'memorial', memorial: 'plaque'}, title: 'Blue plaque to Charles Dickens'}],
  ['art', {tags: {tourism: 'artwork', artwork_type: 'mural'}, title: 'Hope Mural'}],
  ['event', {ai: {kind: 'Film location'}, src: 'AI guide', title: 'Back to the Future clock tower scene'}],
  ['folk', {ai: {kind: 'Haunted house', folklore: true}, src: 'AI guide', title: 'The Grey Lady'}],
  ['indig', {facts: ['Marae'], title: 'Ōrākei Marae'}],
  ['indig', {facts: ['Village site'], title: 'X̱wáýx̱way'}],
  ['museum', {facts: ['Art museum'], title: 'Museum of Neon Art'}],
  ['monu', {facts: ['Colossal statue'], title: 'Statue of Liberty'}],
  ['bldg', {extract: 'The Burbank Central Library is a public library in Burbank, California.', title: 'Burbank Central Library'}],
  ['event', {facts: ['Battlefield'], title: 'Battle of Bannockburn'}],
  ['other', {title: 'Smith'}]
];
const N = [
  ['peak', {facts: ['Mountain', '5,000 ft elevation'], title: 'Mount Lee'}],
  ['water', {tags: {natural: 'spring'}, title: 'Sycamore Spring'}],
  ['view', {tags: {tourism: 'viewpoint'}, title: 'Hollywood Sign view'}],
  ['wild', {src: 'eBird', title: 'Lake Balboa'}],
  ['rock', {facts: ['Quarry'], title: 'Old Quarry'}],
  ['tree', {tags: {natural: 'tree'}, title: 'Big Oak'}],
  ['park', {tags: {leisure: 'nature_reserve'}, title: 'Lake Wood Reserve'}],
  ['camp', {facts: ['Trail'], title: 'Brush Canyon Trail'}],
  ['wild', {facts: ['Bird sanctuary'], title: 'Ballona'}]
];
(async () => {
  const b = await chromium.launch(), pg = await b.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2});
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/^https?:\/\//, r => /cdnjs|fonts|tile\.openstreetmap/.test(r.request().url()) ? r.continue() : r.abort());
  await pg.goto('file://' + ROOT + '/index.html'); await pg.waitForTimeout(400);
  const ok = (what, cond) => console.log((cond ? 'ok   ' : 'FAIL ') + what);
  const res = await pg.evaluate(([H, N]) => {
    localStorage.clear(); state.pos = {lat: 34.18172, lon: -118.31143}; state.manual = true; state.langs = ['en']; state.place = 'Burbank'; state.loading = false; state.lastLoadTime = Date.now();
    const mk = ([want, x], i) => ({want, it: {key: 'k' + i, src: x.src, lat: 34.18172 + i * .0003, lon: -118.31143, facts: x.facts || [], tags: x.tags, ai: x.ai, versions: {en: {title: x.title, extract: x.extract || '', url: '#'}}}});
    const run = list => list.map(mk).map(({want, it}) => ({want, got: catOf(it), title: it.versions.en.title}));
    state.mode = 'history'; const h = run(H); state.mode = 'nature'; const n = run(N); state.mode = 'history';
    H.map(mk).filter(({it}) => !it.ai).forEach(({it}) => state.items.set(it.key, it));
    // AI guide places come from a saved guide (render rebuilds them from storage)
    addGuide(normalizeGuide({wander: 1, area: {name: 'Burbank', lat: 34.18172, lon: -118.31143, summary: 'Stand-in.'}, places: [
      {name: 'The Grey Lady', kind: 'Haunted house', folklore: true, lat: 34.1822, lon: -118.3118, summary: 'A ghost story (stand-in).'},
      {name: 'Clock tower scene', kind: 'Film location', lat: 34.1812, lon: -118.3109, summary: 'Filmed here (stand-in).'}]}));
    state.items.set('w1', {key: 'w1', lat: 34.1819, lon: -118.3112, versions: {en: {title: 'Burbank City Hall', extract: 'Burbank City Hall is a city hall building.', url: '#'}}, facts: []});
    render();
    return {h, n}; }, [H, N]);
  for(const r of [...res.h, ...res.n]) ok(`${r.title} → ${r.got}${r.got !== r.want ? ' (wanted ' + r.want + ')' : ''}`, r.got === r.want);
  const chips = () => pg.evaluate(() => [...document.querySelectorAll('.lg-cats [data-cat]')].map(b => b.textContent + (b.getAttribute('aria-pressed') === 'false' ? ' (off)' : '')));
  console.log('chips:', (await chips()).join(' · '));
  const pins = await pg.evaluate(() => [...document.querySelectorAll('#map .pin')].map(p => p.className.replace('pin ', '')).slice(0, 6));
  console.log('pins:', pins.join(' / '));
  ok('pins coloured by category', pins.some(c => /c-relig/.test(c)) && pins.some(c => /src-ai/.test(c)));
  await pg.evaluate(() => document.querySelector('.legend').scrollIntoView({block: 'center'}));
  const clip = async () => { const r = await pg.$eval('.legend', e => { const x = e.getBoundingClientRect(); return {y: x.y}; }); return {x: 0, y: Math.max(0, r.y - 60), width: 390, height: 420}; };
  await pg.screenshot({path: OUT + '/categories-chips.png', clip: await clip()});

  // hide a category: its cards and pins go, and the note says so
  await pg.click('.lg-cats [data-cat="relig"]'); await pg.waitForTimeout(200);
  const afterCat = await pg.evaluate(() => ({cards: document.querySelectorAll('#listWrap article[data-key]').length, note: (document.querySelector('.hidden-note') || {}).innerText, saved: localStorage.getItem('wander.hiddenCat')}));
  console.log('after hiding Religious:', JSON.stringify(afterCat));
  ok('category hidden and remembered', /Religious sites/.test(afterCat.note || '') && /relig/.test(afterCat.saved || ''));

  // the Sources menu: opens, hides AI guide places, closes on an outside tap
  await pg.click('.lg-srcbtn'); await pg.waitForTimeout(150);
  const menu = await pg.evaluate(() => ({open: !document.querySelector('#lgMenu').hidden, rows: [...document.querySelectorAll('#lgMenu [data-src]')].filter(b => !b.hidden).map(b => b.textContent)}));
  console.log('menu:', JSON.stringify(menu));
  await pg.screenshot({path: OUT + '/categories-menu.png', clip: await clip()});
  await pg.click('#lgMenu [data-src="ai"]'); await pg.waitForTimeout(150);
  const afterSrc = await pg.evaluate(() => ({stillOpen: !document.querySelector('#lgMenu').hidden, dot: !document.querySelector('.lg-srcbtn .lg-dot').hidden, note: document.querySelector('.hidden-note').innerText}));
  console.log('after hiding AI guide:', JSON.stringify(afterSrc));
  ok('menu stays open while choosing, dot shows a source is off', afterSrc.stillOpen && afterSrc.dot && /AI guide/.test(afterSrc.note));
  await pg.click('.lg-you'); await pg.waitForTimeout(150);
  ok('tap elsewhere closes the menu', await pg.evaluate(() => document.querySelector('#lgMenu').hidden));
  await pg.click('#showAllSrc'); await pg.waitForTimeout(150);
  ok('Show all brings everything back', await pg.evaluate(() => !document.querySelector('.hidden-note') && state.hiddenCat.size === 0 && state.hiddenSrc.size === 0));

  // Nature mode: its own categories
  await pg.evaluate(([N]) => { state.mode = 'nature'; state.items.clear(); N.forEach(([, x], i) => state.items.set('n' + i, {key: 'n' + i, src: x.src, lat: 34.18172 + i * .0004, lon: -118.31143, facts: x.facts || [], tags: x.tags, versions: {en: {title: x.title, extract: '', url: '#'}}})); applyModeUI(); render(); }, [N]);
  console.log('nature chips:', (await chips()).join(' · '));
  await pg.screenshot({path: OUT + '/categories-nature.png', clip: await clip()});
  console.log('errors', errs); await b.close();
})();
