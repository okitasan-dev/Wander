const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright'); const fs=require('fs'); const SP=OUT;
const J=(r,body)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
const REAL=/^(localhost|macrostrat\.org|tiles\.macrostrat\.org|api\.inaturalist\.org|api\.open-meteo\.com|gbank\.gsj\.jp|map\.bgs\.ac\.uk|services\.ga\.gov\.au|overpass-api\.de|query\.wikidata\.org|nominatim\.openstreetmap\.org|tile\.openstreetmap\.org|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|inaturalist-open-data\.s3\.amazonaws\.com|static\.inaturalist\.org|geoservices\.brgm\.fr)$/;
const ALL=[['Los Angeles',34.1366,-118.2942],['London',51.4993,-0.1273],['Kyoto',35.0037,135.7788],['Sydney',-33.8688,151.2093],['Paris',48.8575,2.3600]]; const PLACES=process.env.ONLY?ALL.filter(p=>process.env.ONLY.split(',').includes(p[0])):ALL;
(async()=>{ const srv = await require('./serve.js')(8772);
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); const fails={};
  pg.on('requestfailed', r=>{ const h=new URL(r.url()).hostname; if(REAL.test(h)) fails[h]=(fails[h]||0)+1; });
  await pg.route(/^https?:\/\//, r=>{ const u=new URL(r.request().url()), h=u.hostname;
    if(REAL.test(h)) return r.continue();
    if(h==='www.wikidata.org') return J(r,{entities:{}});
    if(/wikipedia\.org$/.test(h)){ const titles=(u.searchParams.get('titles')||'').split('|').filter(Boolean);
      return J(r,{query:{pages:titles.map(t=>({title:t,extract:`${t} (stand-in text).`,fullurl:'https://en.wikipedia.org/wiki/'+encodeURIComponent(t)}))}}); }
    return r.abort(); });
  await pg.goto('http://localhost:8772/index.html'); await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ localStorage.clear(); localStorage.setItem('wander.mode','"nature"'); localStorage.setItem('wander.mapLayer','"geo"'); localStorage.setItem('wander.radius','805'); });
  await pg.reload(); await pg.waitForTimeout(500);
  for(const [name,lat,lon] of PLACES){
    await pg.evaluate(([lat,lon])=>{ state.expanded.clear(); setManual(lat,lon); }, [lat,lon]);
    await pg.waitForFunction(()=>!state.loading && state.nature && !state.nature.loading, null, {timeout:90000}).catch(()=>console.log('  (timed out waiting)'));
    await pg.waitForTimeout(2500);
    const r = await pg.evaluate(()=>{ const n=state.nature||{}; const u=x=>x&&{name:x.name,rock:x.rock,interval:x.interval,age:x.age,setting:x.setting,src:x.src,map:x.map&&x.map.title,link:x.link,surface:x.surface&&x.surface.name};
      return {cc:state.cc, teaser:document.querySelector('.card.nat .sub')?.textContent, local:u(n.local), macro:u(n.geo), elev:n.elev, species:n.speciesTotal, top3:(n.species||[]).slice(0,3).map(s=>s.common),
        items:state.items.size, geoTiles:[...new Set([...document.querySelectorAll('.leaflet-pane img')].map(i=>new URL(i.src).hostname))].join(', '), attr:document.querySelector('.leaflet-control-attribution')?.textContent}; });
    console.log(`\n=== ${name}`, JSON.stringify(r,null,1));
    await pg.evaluate(()=>{ state.expanded.add('nature'); render(); scrollTo(0,0); }); await pg.waitForTimeout(1500);
    await pg.screenshot({path:`${SP}/geo-${name.replace(' ','')}-map.png`});
    await pg.evaluate(()=>{ document.querySelector('#areaWrap').scrollIntoView(); }); await pg.waitForTimeout(500);
    await pg.screenshot({path:`${SP}/geo-${name.replace(' ','')}-card.png`});
  }
  // Paris: an AI guide fills the gaps
  const g={wander:1,mode:'nature',area:{name:'Le Marais',lat:48.8575,lon:2.36,summary:'The Marais is a drained marsh in an old meander of the Seine, on river silts over Eocene limestone.',
    ground:{bedrock:{name:'Calcaire grossier (Lutetian limestone)',rock:'Coarse shelly limestone',age:'c. 45 million years old',notes:'The stone of most of old Paris, quarried under the Left Bank; look at the façades of the hôtels particuliers.',mapSheet:'BRGM 1:50,000 sheet 183, Paris'},
      surface:'Modern alluvium and peaty marsh silts of the former Seine channel, a few metres thick.',soil:'Mostly made ground over silty alluvium.',water:'The Seine’s abandoned northern channel ran here; groundwater sits close to the surface.',climate:'Temperate oceanic; mild, damp winters.'},
    sources:[{title:'BRGM notice',url:'https://example.org/notice.pdf#page=4'}]},places:[]};
  await pg.evaluate(()=>{ openGuide(); }); await pg.fill('#gImport', JSON.stringify(g)); await pg.click('#gImportBtn'); await pg.waitForTimeout(3000);
  console.log('\nimport:', await pg.$eval('#gMsg',e=>e.textContent));
  console.log('after import:', JSON.stringify(await pg.evaluate(()=>({nature: !!state.nature, natLoading: state.nature && state.nature.loading, mode: state.mode, ag: state.areaGuide && state.areaGuide.name, ground: !!(state.areaGuide && state.areaGuide.ground), guides: loadGuides().map(g=>[g.mode, g.area.name, !!g.area.ground]), area: document.querySelector('#areaWrap').innerHTML.slice(0,200)}))));
  await pg.evaluate(()=>{ document.querySelector('#guide').open=false; state.expanded.add('nature'); render(); document.querySelector('.card.nat .layers').scrollIntoView(); scrollBy(0,-80); }); await pg.waitForTimeout(800);
  await pg.screenshot({path:`${SP}/geo-Paris-ai.png`});
  const pr = await pg.evaluate(()=>{ openGuide(); return document.querySelector('#gPrompt').value; });
  console.log('\nPROMPT KNOWS (Paris):', pr.split('WHAT MY APP ALREADY KNOWS')[1].split('Places (id')[0]);
  console.log('fails', JSON.stringify(fails), 'errors', errs);
  await b.close(); srv.close && srv.close(); process.exit(0);
})();
