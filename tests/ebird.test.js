const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright'); const SP=OUT, fs=require('fs');
const KEY = (process.env.WANDER_EBIRD_KEY || '').trim();   // never commit a key: pass it in the environment
if(!KEY){ console.log('skipped: set WANDER_EBIRD_KEY to run'); process.exit(0); }
const J=(r,body)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
(async()=>{ const srv = await require('./serve.js')(8781); const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'}); const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:\/\//, r=>{ const u=new URL(r.request().url()), h=u.hostname;
    if(/localhost|cdnjs|fonts|query\.wikidata\.org|tile\.openstreetmap|nominatim|api\.inaturalist|inaturalist-open-data|api\.ebird\.org|api\.gbif\.org/.test(h)) return r.continue();
    if(h==='www.wikidata.org') return J(r,{entities:{}}); if(/wikipedia|wikivoyage|commons/.test(h)) return J(r,{query:{pages:[],geosearch:[]}}); if(/overpass/.test(h)) return J(r,{elements:[]});
    return J(r,{}); });
  await pg.goto('http://localhost:8781/index.html'); await pg.evaluate(()=>{ localStorage.clear(); localStorage.setItem('wander.mode','"nature"'); }); await pg.reload(); await pg.waitForTimeout(300);
  await pg.evaluate(()=>{ document.querySelector('#settings').open = true; });
  await pg.fill('#ebirdKey', KEY); await pg.dispatchEvent('#ebirdKey', 'change');
  await pg.evaluate(()=>{ document.querySelector('#settings').open = false; setManual(34.1366,-118.2942); });
  await pg.waitForFunction(()=>state.nature && state.nature.ebird, null, {timeout:90000}); await pg.waitForTimeout(6000);
  await pg.evaluate(()=>{ state.expanded.add('nature'); render(); });
  const r = await pg.evaluate(()=>{ const eb=state.nature.ebird; const h=[...document.querySelectorAll('.layer h4')].find(x=>x.textContent==='Birds lately');
    return {desc: h && h.closest('.layer').querySelector('.ldesc').textContent, first: eb.list.slice(0,6).map(x=>`${x.common}${x.rare?' [RARE]':''}${x.photo?' (photo)':''} ${x.when}`), rare: eb.rare.slice(0,4).map(r=>`${r.name} @ ${r.where} ${r.when}`),
      hotspots: [...state.items.values()].filter(i=>i.src==='eBird').slice(0,4).map(i=>`${Object.values(i.versions)[0].title} [${i.facts.join('; ')}]`), chip: document.querySelector('.legend .g-ebird').textContent,
      keyInStorage: !!localStorage.getItem('wander.ebirdKey')}; });
  console.log(JSON.stringify(r, null, 1));
  await pg.evaluate(()=>{ const h=[...document.querySelectorAll('.layer h4')].find(x=>x.textContent==='Birds lately'); h.scrollIntoView(); scrollBy(0,-10); }); await pg.waitForTimeout(1500);
  await pg.screenshot({path:SP+'/ebird.png'});
  console.log('errors', errs); await b.close(); srv.close && srv.close(); process.exit(0); })();
