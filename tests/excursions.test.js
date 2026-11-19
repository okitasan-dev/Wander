const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright'); const SP=OUT;
const J=(r,body)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
(async()=>{ const srv = await require('./serve.js')(8775); const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'}); const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:\/\//, r=>{ const u=new URL(r.request().url()), h=u.hostname;
    if(/localhost|cdnjs|fonts|query\.wikidata\.org|tile\.openstreetmap|nominatim|api\.inaturalist|inaturalist-open-data/.test(h)) return r.continue();
    if(/overpass/.test(h)){ const q=decodeURIComponent(u.search);
      if(/hot_spring/.test(q)) return J(r,{elements:[{type:'node',id:11,lat:44.2445,lon:-115.0645,tags:{natural:'hot_spring',name:'Kirkham Hot Springs',fee:'yes',operator:'Boise National Forest'}},{type:'node',id:12,lat:44.36,lon:-115.23,tags:{natural:'hot_spring'}}]});
      if(/leisure=fishing/.test(q)) return J(r,{elements:[{type:'node',id:21,lat:44.28,lon:-115.05,tags:{leisure:'fishing',name:'South Fork Payette access'}},{type:'way',id:22,center:{lat:44.14,lon:-115.0},tags:{natural:'water',water:'lake',fishing:'yes',name:'Warm Lake'}}]});
      return J(r,{elements:[]}); }
    if(h==='www.wikidata.org') return J(r,{entities:{}});
    if(/wikipedia/.test(h)) return J(r,{query:{pages:[]}});
    return J(r,{}); });
  await pg.goto('http://localhost:8775/index.html'); await pg.evaluate(()=>{ localStorage.clear(); localStorage.setItem('wander.mode','"nature"'); localStorage.setItem('wander.farRadius','80467'); }); await pg.reload(); await pg.waitForTimeout(300);
  await pg.evaluate(()=>setManual(44.29,-115.06));
  await pg.waitForFunction(()=>state.far.size>0 && !state.loading, null, {timeout:90000}); await pg.waitForTimeout(3000);
  const sum = () => pg.evaluate(()=>{ const rows=farRows(); return {cc:state.cc, springs: rows.filter(r=>r.it.topic==='spring').length, fish: rows.filter(r=>r.it.topic==='fish').length,
    first: rows.filter(r=>r.it.topic==='spring').slice(0,6).map(r=>`${r.it.name} (${fmtDist(r.d)}, ${r.it.tempF??'?'}°F, ${r.it.developed===true?'dev':r.it.developed===false?'wild':'?'}, ${r.it.src}${r.it.also?'+'+r.it.also:''})`),
    fishList: state.farFish && state.farFish.list.slice(0,5).map(x=>x.name), chips:[...document.querySelectorAll('.legend .g-far')].map(b=>b.hidden?'(hidden)':b.textContent), pins: M.far ? M.far.size : 0, cards: document.querySelectorAll('.card.far').length}; });
  console.log('LIVE', JSON.stringify(await sum(), null, 1));
  // AI springs guide: one matches a NOAA spring, one is a secret spot
  const g={wander:1,mode:'nature',topic:'springs',area:{name:'Boise National Forest',lat:44.29,lon:-115.06,summary:'Dozens of springs line the South Fork Payette and Middle Fork Boise rivers.',sources:[{title:'x',url:'https://example.org'}]},
    places:[{id:null,name:'Kirkham Hot Springs',kind:'Developed hot springs (campground)',developed:true,lat:44.2448,lon:-115.0641,temperature:'Up to 120°F (49°C)',access:'Pull-off on Highway 21; short path down to the river.',land:'Boise National Forest; day-use fee',season:'Best late summer to winter; pools flood in spring runoff',safety:'Scalding source water',summary:'Hot waterfalls and rock pools on the South Fork Payette.',sources:[{title:'USFS',url:'https://www.fs.usda.gov/'}],confidence:'high'},
      {id:null,name:'Secret Creek Seep',kind:'Wild hot spring',developed:false,lat:44.33,lon:-115.12,temperature:'About 100°F',access:'2-mile bushwhack up an unnamed drainage from FR 555',land:'National forest',summary:'A tiny rock-ringed pool few people know about, from a 2009 trip report.',sources:[{title:'trip report',url:'https://example.org/trip'}],confidence:'low'}]};
  await pg.evaluate(()=>openGuide()); await pg.fill('#gImport', JSON.stringify(g)); await pg.click('#gImportBtn'); await pg.waitForTimeout(2000);
  console.log('import:', await pg.$eval('#gMsg', e=>e.textContent));
  await pg.evaluate(()=>{ document.querySelector('#guide').open=false; });
  console.log('AFTER AI', JSON.stringify(await sum(), null, 1));
  for(const f of ['wild','dev','all']){ await pg.evaluate(f=>{ state.springFilter=f; render(); }, f); console.log('filter', f, await pg.evaluate(()=>[...document.querySelectorAll('.card.far')].filter(c=>c.querySelector('.fi.spring')).length), 'pins', await pg.evaluate(()=>M.far.size)); }
  // prompt
  await pg.evaluate(()=>{ openGuide(); document.querySelector('input[name="gTopic"][value="springs"]').click(); });
  const pr = await pg.$eval('#gPrompt', e=>e.value); console.log('PROMPT:', pr.slice(0,330).replace(/\n/g,' / '), '…\n  KNOWS lines:', (pr.split('WHAT MY APP ALREADY KNOWS')[1]||'').split('\n').slice(1,4).join(' / '));
  console.log('far row visible:', await pg.$eval('#gFarRow', e=>!e.hidden), 'area row hidden:', await pg.$eval('#gAreaRow', e=>e.hidden));
  await pg.evaluate(()=>{ document.querySelector('input[name="gTopic"][value="fishing"]').click(); }); const pf = await pg.$eval('#gPrompt', e=>e.value); console.log('FISH PROMPT:', pf.slice(0,200).replace(/\n/g,' / '));
  await pg.evaluate(()=>{ document.querySelector('#guide').open=false; const h=[...document.querySelectorAll('h2.band b')].find(b=>b.textContent==='Excursions'); h.scrollIntoView(); state.expanded.add([...state.far.values()].find(x=>x.name==='Kirkham Hot Springs').key); render(); [...document.querySelectorAll('h2.band b')].find(b=>b.textContent==='Excursions').scrollIntoView(); });
  await pg.waitForTimeout(600); await pg.screenshot({path:SP+'/far-list.png'});
  await pg.evaluate(()=>{ scrollTo(0,0); M.map.setView([44.29,-115.06], 10); }); await pg.waitForTimeout(1500); await pg.screenshot({path:SP+'/far-map.png'});
  console.log('errors', errs); await b.close(); srv.close && srv.close(); process.exit(0); })();
