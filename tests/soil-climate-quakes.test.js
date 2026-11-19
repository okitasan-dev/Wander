const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright'); const fs=require('fs'); const SP=OUT;
const J=(r,body)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
const REAL=/^(localhost|earthquake\.usgs\.gov|rest\.isric\.org|archive-api\.open-meteo\.com|hydro\.nationalmap\.gov|macrostrat\.org|tiles\.macrostrat\.org|api\.inaturalist\.org|api\.open-meteo\.com|gbank\.gsj\.jp|map\.bgs\.ac\.uk|services\.ga\.gov\.au|overpass-api\.de|query\.wikidata\.org|nominatim\.openstreetmap\.org|tile\.openstreetmap\.org|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|inaturalist-open-data\.s3\.amazonaws\.com|static\.inaturalist\.org|geoservices\.brgm\.fr)$/;
const ALL=[['Los Angeles',34.1366,-118.2942],['London',51.4993,-0.1273],['Kyoto',35.0037,135.7788],['Sydney',-33.8688,151.2093],['Paris',48.8575,2.3600]]; const PLACES0=process.env.ONLY?ALL.filter(p=>process.env.ONLY.split(',').includes(p[0])):ALL;
(async()=>{ const srv = await require('./serve.js')(8772);
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); const fails={};
  pg.on('requestfailed', r=>{ const h=new URL(r.url()).hostname; if(REAL.test(h)) fails[h]=(fails[h]||0)+1; });
  await pg.route(/^https?:\/\//, r=>{ const u=new URL(r.request().url()), h=u.hostname;
    if(/overpass/.test(h)){ const q=decodeURIComponent(u.search); if(/out tags 5000/.test(q)){ const T=[['Platanus x hispanica','London plane',140],['Tilia x europaea','common lime',60],['Sorbus aria','whitebeam',22],['Prunus avium','wild cherry',15],['Betula pendula','silver birch',9]]; let id=1; const els=[]; for(const [sp,en,n] of T) for(let i=0;i<n;i++) els.push({type:'node',id:id++,tags:{natural:'tree',species:sp,'species:en':en}}); return J(r,{elements:els}); } return J(r,{elements:[]}); }
    if(REAL.test(h)) return r.continue();
    if(h==='www.wikidata.org') return J(r,{entities:{}});
    if(/wikipedia\.org$/.test(h)){ const titles=(u.searchParams.get('titles')||'').split('|').filter(Boolean);
      return J(r,{query:{pages:titles.map(t=>({title:t,extract:`${t} (stand-in text).`,fullurl:'https://en.wikipedia.org/wiki/'+encodeURIComponent(t)}))}}); }
    return r.abort(); });
  await pg.goto('http://localhost:8772/index.html'); await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ localStorage.clear(); localStorage.setItem('wander.mode','"nature"'); localStorage.setItem('wander.mapLayer','"geo"'); localStorage.setItem('wander.radius','805'); });
  await pg.reload(); await pg.waitForTimeout(500);
  for(const [name,lat,lon] of PLACES0){
    await pg.evaluate(([lat,lon])=>{ state.expanded.clear(); setManual(lat,lon); }, [lat,lon]);
    await pg.waitForFunction(()=>!state.loading && state.nature && !state.nature.loading, null, {timeout:90000}).catch(()=>console.log('  (timed out waiting)'));
    await pg.waitForFunction(()=>state.nature && state.nature.soil!==undefined && state.nature.climate!==undefined, null, {timeout:45000}).catch(()=>console.log('  (soil/climate still pending)')); await pg.waitForTimeout(800);
    const r = await pg.evaluate(()=>{ const n=state.nature||{}; const u=x=>x&&{name:x.name,rock:x.rock,interval:x.interval,age:x.age,setting:x.setting,src:x.src,map:x.map&&x.map.title,link:x.link,surface:x.surface&&x.surface.name};
      return {cc:state.cc, teaser:document.querySelector('.card.nat .sub')?.textContent, local:u(n.local), macro:u(n.geo), elev:n.elev, species:n.speciesTotal, top3:(n.species||[]).slice(0,3).map(s=>s.common),
        items:state.items.size, soil:n.soil, climate:n.climate&&{code:n.climate.code,name:n.climate.name,hot:n.climate.hot,hotHigh:Math.round(n.climate.hotHigh),coldLow:Math.round(n.climate.coldLow),rain:Math.round(n.climate.rainYear)}, quakes:(n.quakes||[]).map(q=>`M${q.mag} ${q.place} ${q.year}`), water:n.water, season: n.season && {month:n.season.month, total:n.season.total, list:n.season.list.slice(0,9).map(x=>x.common+(x.seasonal?' ['+Math.round(x.share*100)+'%]':'')), flowering:n.season.flowering.map(x=>x.common)}, plants: n.plants && {region:n.plants.region, nat:n.plants.nativeTotal, intro:n.plants.introducedTotal, top:n.plants.native.slice(0,4).map(x=>x.common), introTop:n.plants.introduced.slice(0,3).map(x=>x.common)}, trees: n.trees && {total:n.trees.total, kinds:n.trees.kinds, top:n.trees.top.slice(0,3).map(t=>t.name+' '+t.n)}, geoTiles:[...new Set([...document.querySelectorAll('.leaflet-pane img')].map(i=>new URL(i.src).hostname))].join(', '), attr:document.querySelector('.leaflet-control-attribution')?.textContent}; });
    console.log(`\n=== ${name}`, JSON.stringify(r,null,1));
    await pg.evaluate(()=>{ state.expanded.add('nature'); render(); scrollTo(0,0); }); await pg.waitForTimeout(1500);
    await pg.screenshot({path:`${SP}/geo-${name.replace(' ','')}-map.png`});
    await pg.evaluate(()=>{ const h=[...document.querySelectorAll('.layer h4')].find(x=>/Ground/.test(x.textContent)); (h||document.querySelector('#areaWrap')).scrollIntoView(); scrollBy(0,-20); }); await pg.waitForTimeout(1500);
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
