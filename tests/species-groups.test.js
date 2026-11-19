const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright'); const SP=OUT;
const J=(r,body)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
(async()=>{ const srv = await require('./serve.js')(8776); const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'}); const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:\/\//, r=>{ const u=new URL(r.request().url()), h=u.hostname;
    if(/localhost|cdnjs|fonts|query\.wikidata\.org|tile\.openstreetmap|nominatim|api\.inaturalist|inaturalist-open-data/.test(h)) return r.continue();
    if(h==='www.wikidata.org') return J(r,{entities:{}}); if(/wikipedia/.test(h)) return J(r,{query:{pages:[]}}); if(/overpass/.test(h)) return J(r,{elements:[]});
    return J(r,{}); });
  await pg.goto('http://localhost:8776/index.html'); await pg.evaluate(()=>{ localStorage.clear(); localStorage.setItem('wander.mode','"nature"'); }); await pg.reload(); await pg.waitForTimeout(300);
  await pg.evaluate(()=>{ setManual(34.1366,-118.2942); });
  await pg.waitForFunction(()=>state.nature && !state.nature.loading && state.nature.groups, null, {timeout:90000}); await pg.waitForTimeout(1000);
  await pg.evaluate(()=>{ state.expanded.add('nature'); render(); });
  const chips = sec => pg.$$eval(`[data-grp="${sec}"]`, bs=>bs.map(b=>(b.getAttribute('aria-pressed')==='true'?'*':'')+b.textContent));
  console.log('life chips', JSON.stringify(await chips('life'))); console.log('season chips', JSON.stringify(await chips('season'))); console.log('plant chips', JSON.stringify(await chips('plants')));
  const sect = name => pg.evaluate(name=>{ const h=[...document.querySelectorAll('.layer h4')].find(x=>x.textContent.startsWith(name)); const s=h&&h.closest('.layer'); return s ? s.querySelector('.ldesc')?.textContent.slice(0,110)+' | '+[...s.querySelectorAll('.species .sp b')].slice(0,5).map(b=>b.textContent).join(', ') : 'none'; }, name);
  for(const [sec,g,name] of [['life','Mammalia','Life'],['life','Fungi','Life'],['season','Aves','In season'],['plants','136329','Plants'],['plants','121943','Plants'],['life','Fungi','Life']]){
    await pg.click(`[data-grp="${sec}"][data-g="${g}"]`); await pg.waitForFunction(()=>!document.querySelector('.layer .gather'), null, {timeout:30000}).catch(()=>{}); await pg.waitForTimeout(400);
    console.log(sec, g, '→', await sect(name));
  }
  await pg.evaluate(()=>{ const h=[...document.querySelectorAll('.layer h4')].find(x=>x.textContent==='Life'); h.scrollIntoView(); scrollBy(0,-10); }); await pg.waitForTimeout(800); await pg.screenshot({path:SP+'/grp-life.png'});
  await pg.click('[data-grp="life"][data-g=""]'); await pg.waitForTimeout(300); console.log('life All →', await sect('Life'));
  console.log('remembered', await pg.evaluate(()=>localStorage.getItem('wander.natGroup')));
  console.log('errors', errs); await b.close(); srv.close && srv.close(); process.exit(0); })();
