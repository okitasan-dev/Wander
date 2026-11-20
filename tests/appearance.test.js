// Settings → Appearance: Auto follows the phone; Light and Dark override it, on both pages, after a reload, with no flash.
const {OUT} = require('./paths');
const {chromium} = require('playwright');
const J = (r, body) => r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(body)});
(async () => {
  const b = await chromium.launch(); let fails = 0; const ok = (t, c) => { console.log((c ? 'ok   ' : 'FAIL ') + t); if(!c) fails++; };
  const errs = [];
  const open = async (scheme, page = 'index.html', first) => {
    const ctx = await b.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block', colorScheme: scheme});
    const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
    await pg.route(/^https?:\/\//, r => /cdnjs|fonts/.test(r.request().url()) ? r.continue() : r.abort());
    if(first) await pg.addInitScript(v => { try{ if(!sessionStorage.getItem('x')){ localStorage.setItem('wander.appearance', JSON.stringify(v)); sessionStorage.setItem('x', 1); } }catch(e){} }, first);
    // the colour of the very first frame: read before any later script could repaint
    await pg.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { window.firstBg = getComputedStyle(document.body).backgroundColor; }, {once: true}); });
    await pg.goto('file://' + require('path').resolve(__dirname, '..') + '/' + page); await pg.waitForTimeout(400);
    return {pg, ctx};
  };
  const look = pg => pg.evaluate(() => ({bg: getComputedStyle(document.body).backgroundColor, first: window.firstBg,
    bar: [...document.querySelectorAll('meta[name=theme-color]')].filter(m => matchMedia(m.media).matches).map(m => m.content).join(','),
    setting: document.querySelector('#appearance') && document.querySelector('#appearance').value}));
  const dark = c => { const [r, g, bl] = c.match(/\d+/g).map(Number); return (r + g + bl) / 3 < 100; };

  // phone in dark mode
  let {pg, ctx} = await open('dark');
  let s = await look(pg); console.log('dark phone, Auto:', JSON.stringify(s));
  ok('Auto follows a dark phone', s.setting === 'auto' && dark(s.bg) && s.bar === '#0C2123');
  await pg.evaluate(() => { document.querySelector('#settings').open = true; }); await pg.waitForTimeout(300); await pg.selectOption('#appearance', 'light'); await pg.waitForTimeout(150);
  s = await look(pg); console.log('dark phone, Light:', JSON.stringify(s));
  ok('Light turns dark mode off at once, status bar too', !dark(s.bg) && s.bar === '#E6E9E4');
  await pg.reload(); await pg.waitForTimeout(400);
  s = await look(pg); console.log('after reload:', JSON.stringify(s));
  ok('Light is remembered, and the first frame is already light', s.setting === 'light' && !dark(s.bg) && !dark(s.first));
  await pg.evaluate(() => { document.documentElement.classList.add('nature'); });
  s = await look(pg); ok('Nature colours stay light too', !dark(s.bg));
  await pg.evaluate(() => { document.documentElement.classList.remove('nature'); });
  await pg.screenshot({path: OUT + '/appearance-light-on-dark-phone.png'});
  await ctx.close();
  ({pg, ctx} = await open('dark', 'place.html?id=Q39561', 'light'));
  s = await look(pg); console.log('place page, Light on a dark phone:', JSON.stringify(s));
  ok('the place page follows the setting', !dark(s.bg) && !dark(s.first));
  await ctx.close();

  // phone in light mode
  ({pg, ctx} = await open('light'));
  s = await look(pg); ok('Auto follows a light phone', s.setting === 'auto' && !dark(s.bg));
  await pg.evaluate(() => { document.querySelector('#settings').open = true; }); await pg.waitForTimeout(300); await pg.selectOption('#appearance', 'dark'); await pg.waitForTimeout(150);
  s = await look(pg); console.log('light phone, Dark:', JSON.stringify(s));
  ok('Dark works on a light phone, status bar too', dark(s.bg) && s.bar === '#0C2123');
  await pg.evaluate(() => { document.querySelector('#settings').open = true; }); await pg.waitForTimeout(300); await pg.selectOption('#appearance', 'auto'); await pg.waitForTimeout(150);
  s = await look(pg); ok('back to Auto follows the phone again', !dark(s.bg) && s.bar === '#E6E9E4');
  await ctx.close();
  console.log(fails ? 'FAIL' : 'PASS'); console.log('errors', errs); await b.close(); process.exit(fails ? 1 : 0);
})();
