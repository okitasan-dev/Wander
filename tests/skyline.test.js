const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright'); const SP=OUT;
const J=(r,body)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
(async()=>{ const srv = await require('./serve.js')(8774); const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'}); const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:\/\//, r=>{ const u=new URL(r.request().url()), h=u.hostname;
    if(/localhost|cdnjs|fonts|query\.wikidata\.org|tile\.openstreetmap|nominatim/.test(h)) return r.continue();
    if(h==='api.open-meteo.com' && /elevation/.test(u.pathname)) return J(r,{elevation:[257]});
    if(h==='www.wikidata.org') return J(r,{entities:{}});
    if(/wikipedia/.test(h)) return J(r,{query:{pages:[]}});
    if(/overpass/.test(h)) return J(r,{elements:[]});
    return r.abort(); });
  await pg.goto('http://localhost:8774/index.html'); await pg.evaluate(()=>{ localStorage.clear(); localStorage.setItem('wander.mode','"nature"'); }); await pg.reload(); await pg.waitForTimeout(300);
  await pg.evaluate(()=>setManual(34.1366,-118.2942));
  await pg.waitForFunction(()=>state.skyline && state.nature && !state.nature.loading, null, {timeout:60000});
  console.log('peaks:', await pg.evaluate(()=>state.skyline.peaks.map(p=>`${p.name} ${Math.round(p.ele)}m`).join(', ')));
  for(const hd of [45, 280, 180]){
    const r = await pg.evaluate(hd=>{ look.on=true; look.heading=hd; document.querySelector('#look').hidden=false; document.body.classList.add('looking'); lookApply(true);
      return {facing:document.querySelector('#lookFacing').textContent, sky:[...document.querySelectorAll('#lookBody .sky li')].map(li=>li.innerText.replace(/\n/g,' — ')), body:document.querySelector('#lookBody').innerText.slice(0,120)}; }, hd);
    console.log(hd+'°', JSON.stringify(r));
    if(hd===45) await pg.screenshot({path:SP+'/sky-panel.png'});
  }
  await pg.evaluate(()=>{ look.heading=45; lookApply(true); }); await pg.click('#lookBody .sky li button'); await pg.waitForTimeout(800);
  console.log('map centre after tap:', await pg.evaluate(()=>{ const c=M.map.getCenter(); return [c.lat.toFixed(3), c.lng.toFixed(3), M.map.getZoom()]; }));
  // history mode: no skyline
  await pg.evaluate(()=>{ state.mode='history'; look.heading=45; lookApply(true); }); console.log('history sky items:', await pg.$$eval('#lookBody .sky li', x=>x.length));
  console.log('errors', errs); await b.close(); srv.close && srv.close(); process.exit(0); })();
