const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright'); const fs=require('fs');
const SP=OUT;
(async()=>{ const srv = await require('./serve.js')(8766);
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844}, deviceScaleFactor:2, geolocation:{latitude:34.18172, longitude:-118.31143}, permissions:['geolocation'], serviceWorkers:'block'});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const J = (r, body) => r.fulfill({status:200, contentType:'application/json', headers:{'access-control-allow-origin':'*'}, body:JSON.stringify(body)});
  await pg.route(/^https?:\/\//, r=>{
    const u=new URL(r.request().url());
    if(/cdnjs|fonts|localhost|tile\.openstreetmap/.test(u.hostname)) return r.continue();
    if(u.hostname==='nominatim.openstreetmap.org'){
      if(u.pathname==='/reverse'){ const lat=+u.searchParams.get('lat'), lon=+u.searchParams.get('lon');
        const a = lon>100 ? {neighbourhood:'Gion', city:'Kyoto', country:'Japan', country_code:'jp'} : lon>0 ? {neighbourhood:'Staré Město', city:'Prague', country:'Czechia', country_code:'cz'} : {neighbourhood:'Magnolia Park', city:'Burbank', country:'United States', country_code:'us'};
        return J(r, {address:a, extratags:{}}); }
      if(u.pathname==='/search') return J(r, /gion/i.test(u.searchParams.get('q')) ? [{lat:'35.0040',lon:'135.7785'}] : []);
    }
    return r.abort();
  });
  await pg.goto('http://localhost:8766/index.html'); await pg.waitForTimeout(5000); console.log('status', await pg.$eval('#status', e=>e.textContent), errs);
  const lib = () => pg.evaluate(()=>JSON.parse(localStorage.getItem('wander.places')||'[]').map(e=>`${e.name} [${e.kinds}]${e.pinned?' *':''}`));
  const info = async t => console.log(t, JSON.stringify(await lib()), '| pill:', await pg.$eval('#explore', e=>e.hidden?'hidden':e.textContent), '| remote', await pg.evaluate(()=>state.remote));
  await info('after GPS');
  // search Gion from the Go box
  await pg.evaluate(()=>{ document.querySelector('#settings').open = true; });
  await pg.waitForTimeout(300);
  console.log('short list:', await pg.$$eval('#libShort .lib-go', bs=>bs.map(b=>b.innerText.replace(/\n/g,' — '))));
  await pg.screenshot({path:SP+'/lib-settings.png'});
  await pg.fill('#placeInput', 'Gion Kyoto'); await pg.click('#placeForm button[type=submit]'); await pg.waitForTimeout(6000);
  await info('after search');
  await pg.evaluate(()=>{ document.querySelector('#status').hidden = true; });
  await pg.screenshot({path:SP+'/lib-pill.png'});
  // add a guide for Burbank
  const g = fs.readFileSync(FIX+'/burbank.json','utf8');
  await pg.evaluate(g=>{ addGuide(decodeGuidePayload(g)); }, g);
  // open the full list
  await pg.evaluate(()=>{ document.querySelector('#settings').open = true; }); await pg.waitForTimeout(200);
  await pg.click('#libAll'); await pg.waitForTimeout(300);
  console.log('all:', await pg.$$eval('#libList .lib-row', rs=>rs.map(r=>r.innerText.replace(/\n/g,' — ') + (r.querySelector('.lib-x')?' [x]':''))));
  // pin Prague
  await pg.click('#libList [data-lib-pin="s:Old Town, Prague"]'); await pg.waitForTimeout(200);
  console.log('after pin first row:', await pg.$eval('#libList .lib-row', r=>r.innerText.replace(/\n/g,' — ')));
  await pg.screenshot({path:SP+'/lib-sheet.png'});
  for(const f of ['guide','searched','visited','sample']){ await pg.click(`#libFilter [data-f="${f}"]`); await pg.waitForTimeout(100);
    console.log('filter', f, await pg.$$eval('#libList .lib-go b', bs=>bs.map(b=>b.textContent))); }
  await pg.click(`#libFilter [data-f=""]`);
  // remove the Gion history (sample stays)
  const gid = await pg.evaluate(()=>libEntries().find(r=>/Gion/.test(r.name)).id); console.log("gid", gid);
  await pg.click(`#libList [data-lib-x="${gid}"]`); await pg.waitForTimeout(200);
  console.log('after remove:', await pg.$$eval('#libList .lib-go', bs=>bs.map(b=>b.innerText.replace(/\n/g,' — '))));
  // jump to Prague from the list
  const pid = await pg.evaluate(()=>libEntries().find(r=>/Prague/.test(r.name)).id); console.log('prague pinned?', await pg.$eval(`#libList [data-lib-pin="${pid}"]`, b=>b.getAttribute('aria-pressed'))); await pg.click(`#libList [data-lib-go="${pid}"]`); await pg.waitForTimeout(5000);
  await info('after Prague tap'); console.log('lib open?', await pg.$eval('#lib', e=>e.open), 'pos', await pg.evaluate(()=>[state.pos.lat,state.pos.lon]));
  // back to me
  await pg.click('#backToMe'); await pg.waitForTimeout(5000);
  await info('after back to me');
  // pause GPS: no pill
  await pg.click('#gpsBtn'); await pg.waitForTimeout(400); await info('after pause');
  // turning off visits
  await pg.evaluate(()=>store.set('recordVisits', false));
  // reload: session keeps remote flag
  await pg.evaluate(()=>{ document.querySelector('#settings').open = true; }); await pg.fill('#placeInput', '35.0037, 135.7788'); await pg.click('#placeForm button[type=submit]'); await pg.waitForTimeout(3000);
  await pg.evaluate(()=>saveSession()); await pg.reload(); await pg.waitForTimeout(1500); await info('after reload');
  console.log('errors', errs); await b.close(); srv.close && srv.close(); process.exit(0);
})();
