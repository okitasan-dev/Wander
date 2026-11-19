const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright'); const SP=OUT;
const J=(r,body)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
(async()=>{ const srv = await require('./serve.js')(8780); const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'}); const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:\/\//, r=>{ const u=new URL(r.request().url()), h=u.hostname;
    if(/localhost|cdnjs|fonts|query\.wikidata\.org|tile\.openstreetmap|nominatim|arcgis\.com|inspire\.hes\.scot/.test(h)) return r.continue();
    if(h==='www.wikidata.org') return J(r,{entities:{}}); if(/wikipedia|wikivoyage|commons/.test(h)) return J(r,{query:{pages:[],geosearch:[]}}); if(/overpass/.test(h)) return J(r,{elements:[]});
    return J(r,{}); });
  await pg.goto('http://localhost:8780/index.html'); await pg.evaluate(()=>{ localStorage.clear(); localStorage.setItem('wander.radius','805'); }); await pg.reload(); await pg.waitForTimeout(300);
  for(const [name,lat,lon] of [['Edinburgh Royal Mile',55.9500,-3.1900]]){
    await pg.evaluate(([lat,lon])=>{ state.items.clear(); setManual(lat,lon); }, [lat,lon]);
    await pg.waitForFunction(()=>!state.loading && state.lastLoadTime>0, null, {timeout:120000}); await pg.waitForTimeout(1500);
    const r = await pg.evaluate(()=>{ const its=[...state.items.values()], by={}; its.forEach(i=>{ by[i.src||'Wikipedia']=(by[i.src||'Wikipedia']||0)+1; });
      const reg=its.filter(i=>REG_SRC.test(i.src||'')); const merged=its.filter(i=>!REG_SRC.test(i.src||'') && i.heLink);
      return {sub: state.sub, bySource: by, newCards: reg.slice(0,5).map(i=>`${Object.values(i.versions)[0].title} [${i.facts.join('; ')}]${Object.values(i.versions)[0].extract?' · '+Object.values(i.versions)[0].extract.slice(0,70):''}`),
        mergedInto: merged.slice(0,3).map(i=>`${Object.values(i.versions)[0].title} +[${i.facts.filter(f=>/Grade|Category|Scheduled|care|importance|monument|Heritage|landscape|battle|park/i.test(f)).join('; ')}]${i.regText?' text':''}`)}; });
    console.log('\n===', name, JSON.stringify(r, null, 1));
  }
  console.log('errors', errs); await b.close(); srv.close && srv.close(); process.exit(0); })();
