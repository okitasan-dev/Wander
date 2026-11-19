// Nature mode: after looking at an away place, going back to GPS must rename the "About this land" card.
const {chromium}=require('playwright');
const J=(r,body)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
(async()=>{ const srv = await require('./serve.js')(8766);
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block', geolocation:{latitude:34.18, longitude:-118.31}, permissions:['geolocation']});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:\/\//, r=>{ const u=new URL(r.request().url()), h=u.hostname;
    if(/cdnjs|fonts|localhost/.test(h)) return r.continue();
    if(h==='nominatim.openstreetmap.org'){ const away = +u.searchParams.get('lat') > 30 && +u.searchParams.get('lon') > 0;
      return J(r, u.pathname==='/reverse' ? {address: away ? {neighbourhood:'Gion',city:'Kyoto',country:'Japan',country_code:'jp'} : {neighbourhood:'Magnolia Park',city:'Burbank',country:'United States',country_code:'us'}, extratags:{}} : []); }
    if(h==='query.wikidata.org') return J(r,{results:{bindings:[]}});
    return r.abort(); });
  await pg.goto('http://localhost:8766/index.html'); await pg.evaluate(()=>localStorage.clear()); await pg.reload(); await pg.waitForTimeout(500);
  await pg.evaluate(()=>{ if(state.mode!=='nature') document.querySelector('#modeBtn').click(); });
  const head = () => pg.evaluate(()=>({mode: state.mode, hood: state.hood, city: state.city, heading: document.querySelector('.card.nat h3')?.textContent}));
  await pg.waitForFunction(()=>state.loading && state.pos);   // jump away while the first GPS search is still running
  await pg.evaluate(()=>setManual(35.0037, 135.7788)); await pg.waitForTimeout(3000);
  const away = await head(); console.log('away   ', JSON.stringify(away));
  await pg.evaluate(()=>{ document.querySelectorAll('details.sheet').forEach(x=>x.open=false); document.querySelector('#gpsBtn').click(); }); await pg.waitForTimeout(3000);
  const back = await head(); console.log('gps    ', JSON.stringify(back));
  await pg.evaluate(()=>document.querySelector('#modeBtn').click()); await pg.waitForTimeout(1500);
  await pg.evaluate(()=>document.querySelector('#modeBtn').click()); await pg.waitForTimeout(2500);
  const again = await head(); console.log('swapped', JSON.stringify(again));
  const ok = away.heading==='Gion' && back.heading==='Magnolia Park' && again.heading==='Magnolia Park';
  console.log(ok ? 'PASS' : 'FAIL'); console.log('errors', errs);
  await b.close(); if(srv && srv.close) srv.close(); process.exit(ok ? 0 : 1);
})();
