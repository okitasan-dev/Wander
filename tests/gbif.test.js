const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright'); const SP=OUT;
const J=(r,body)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
(async()=>{ const srv = await require('./serve.js')(8778); const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'}); const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:\/\//, r=>{ const u=new URL(r.request().url()), h=u.hostname;
    if(/localhost|cdnjs|fonts|query\.wikidata\.org|tile\.openstreetmap|nominatim|api\.inaturalist|inaturalist-open-data|api\.gbif\.org/.test(h)) return r.continue();
    if(h==='www.wikidata.org') return J(r,{entities:{}}); if(/wikipedia/.test(h)) return J(r,{query:{pages:[]}}); if(/overpass/.test(h)) return J(r,{elements:[]});
    return J(r,{}); });
  await pg.goto('http://localhost:8778/index.html'); await pg.evaluate(()=>{ localStorage.clear(); localStorage.setItem('wander.mode','"nature"'); localStorage.setItem('wander.radius','1609'); }); await pg.reload(); await pg.waitForTimeout(300);
  for(const [name,lat,lon] of [['Gordes',43.9110,5.2000],['Nairobi',-1.3180,36.8320]]){
    await pg.evaluate(([lat,lon])=>{ state.nature=null; setManual(lat,lon); }, [lat,lon]);
    await pg.waitForFunction(()=>state.nature && !state.nature.loading, null, {timeout:120000}); await pg.waitForTimeout(9000);
    await pg.evaluate(()=>{ state.expanded.add('nature'); render(); });
    const r = await pg.evaluate(()=>{ const n=state.nature; const sec=t=>{ const h=[...document.querySelectorAll('.layer h4')].find(x=>x.textContent.startsWith(t)); return h ? h.closest('.layer').querySelector('.ldesc').textContent.slice(0,200) : '(none)'; };
      return {life: sec('Life'), lifeTop: (n.species||[]).slice(0,10).map(x=>`${x.common}${x.src==='gbif'?' [GBIF'+(x.photo?', photo':'')+']':''}`), gbifShare: (n.species||[]).filter(x=>x.src==='gbif').length+'/'+(n.species||[]).length,
        season: sec('In season'), seasonTop: n.season ? n.season.list.slice(0,8).map(x=>`${x.common}${x.src==='gbif'?' [GBIF]':''}${x.seasonal?' *':''}`) : null,
        plants: sec('Plants'), plantsAny: n.plantsAny ? n.plantsAny.list.slice(0,5).map(x=>x.common) : null}; });
    console.log('\n===', name, JSON.stringify(r, null, 1));
    await pg.click('[data-grp="life"][data-g="Aves"]'); await pg.waitForFunction(()=>!document.querySelector('.layer .gather'), null, {timeout:60000}).catch(()=>{}); await pg.waitForTimeout(500);
    console.log('birds:', await pg.evaluate(()=>{ const h=[...document.querySelectorAll('.layer h4')].find(x=>x.textContent==='Life').closest('.layer'); return h.querySelector('.ldesc').textContent.slice(0,140)+' | '+[...h.querySelectorAll('.sp b')].slice(0,8).map(b=>b.textContent).join(', '); }));
    await pg.evaluate(()=>{ const h=[...document.querySelectorAll('.layer h4')].find(x=>x.textContent==='Life'); h.scrollIntoView(); scrollBy(0,-10); }); await pg.waitForTimeout(1500);
    await pg.screenshot({path:`${SP}/gbif-${name}.png`});
    await pg.click('[data-grp="life"][data-g=""]');
  }
  console.log('errors', errs); await b.close(); srv.close && srv.close(); process.exit(0); })();
