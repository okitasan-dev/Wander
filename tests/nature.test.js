const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright'); const fs=require('fs');
const SP=OUT;
const J=(r,body)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
const MACRO={success:{v:2,license:'CC-BY 4.0',data:[
  {map_id:1,source_id:7,scale:'small',name:'Tertiary marine',lith:'sedimentary',descrip:'',b_int_name:'Miocene',t_int_name:'Miocene',b_age:23,t_age:5.3},
  {map_id:2,source_id:9,scale:'large',name:'Topanga Formation',strat_name:'Topanga Formation',lith:'Major:{sandstone},Minor:{shale,conglomerate}',descrip:'Marine sandstone and conglomerate with interbedded siltstone and shale, laid down in a deep, subsiding basin as the Pacific and North American plates began to slide past each other.',b_int_name:'Langhian',t_int_name:'Serravallian',b_age:15.97,t_age:11.63,ref:{authors:'Dibblee, T.W.',ref_year:'1991'}}]}};
const SPECIES=['Quercus agrifolia|Coast live oak|Plantae','Heteromeles arbutifolia|Toyon|Plantae','Calypte anna|Anna\'s hummingbird|Aves','Sceloporus occidentalis|Western fence lizard|Reptilia','Salvia mellifera|Black sage|Plantae','Sciurus niger|Fox squirrel|Mammalia','Pipilo maculatus|Spotted towhee|Aves','Malosma laurina|Laurel sumac|Plantae','Danaus plexippus|Monarch|Insecta','Eriogonum fasciculatum|California buckwheat|Plantae','Canis latrans|Coyote|Mammalia','Apis mellifera|Western honey bee|Insecta','Sambucus nigra|Black elderberry|Plantae'];
const INAT={total_results:612,results:SPECIES.map((s,i)=>{const [sci,com,g]=s.split('|'); return {count:300-i*17,taxon:{id:1000+i,name:sci,preferred_common_name:com,iconic_taxon_name:g,default_photo:{square_url:`https://static.inaturalist.org/photos/${i}/square.jpg`}}};})};
const OSM={elements:[
  {type:'node',id:1,lat:34.1395,lon:-118.2985,tags:{natural:'spring',name:'Bronson Spring',description:'A small seep below the trail.'}},
  {type:'node',id:2,lat:34.1290,lon:-118.2950,tags:{natural:'peak',name:'Mount Bell',ele:'480'}},
  {type:'node',id:3,lat:34.1352,lon:-118.2930,tags:{natural:'tree',denotation:'natural_monument','species:en':'Coast live oak',height:'18',start_date:'1850'}},
  {type:'node',id:4,lat:34.1370,lon:-118.2960,tags:{tourism:'viewpoint'}},
  {type:'way',id:5,center:{lat:34.1335,lon:-118.2900},tags:{waterway:'stream',name:'Fern Dell Creek'}},
  {type:'way',id:6,center:{lat:34.1325,lon:-118.2905},tags:{waterway:'stream',name:'Fern Dell Creek'}},
  {type:'node',id:7,lat:34.1380,lon:-118.2945,tags:{man_made:'survey_point',ref:'BM 1234'}},
  {type:'node',id:8,lat:34.1360,lon:-118.2925,tags:{natural:'rock',geological:'outcrop',name:'Granite knob'}}]};
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); const hits={};
  await pg.route(/^https?:\/\//, async r=>{ const u=new URL(r.request().url()); const h=u.hostname; hits[h]=(hits[h]||0)+1;
    if(/cdnjs|fonts|tile\.openstreetmap/.test(h)) return r.continue();
    if(h==='query.wikidata.org'){ const q=u.searchParams.get('query')||''; if(/NATURE|wdt:P279\? \?cls/.test(q)) return r.continue(); return J(r,{results:{bindings:[]}}); }
    if(h==='nominatim.openstreetmap.org') return J(r, u.pathname==='/reverse'?{address:{neighbourhood:'Griffith Park',city:'Los Angeles',country:'United States',country_code:'us'},extratags:{}}:[]);
    if(/wikipedia\.org$/.test(h)){ const titles=(u.searchParams.get('titles')||'').split('|').filter(Boolean);
      return J(r,{query:{pages:titles.map(t=>({title:t,extract:`${t} is a natural feature in Los Angeles. (stand-in text)`,fullurl:'https://en.wikipedia.org/wiki/'+encodeURIComponent(t)}))}}); }
    if(h==='macrostrat.org') return J(r,MACRO);
    if(h==='api.open-meteo.com') return J(r,{elevation:[185]});
    if(h==='api.inaturalist.org') return J(r,INAT);
    if(/overpass/.test(h)) return J(r,OSM);
    if(h==='static.inaturalist.org'){ const i=+u.pathname.split('/')[2]%6; return r.fulfill({status:200,contentType:'image/jpeg',body:fs.readFileSync(`${FIX}/sp${i}.jpg`)}); }
    return r.abort(); });
  await pg.goto('file://'+ROOT+'/index.html'); await pg.waitForTimeout(500);
  await pg.evaluate(()=>{ localStorage.clear(); });
  await pg.reload(); await pg.waitForTimeout(400);
  console.log('start mode', await pg.evaluate(()=>state.mode), 'html.nature', await pg.evaluate(()=>document.documentElement.classList.contains('nature')));
  await pg.evaluate(()=>{ state.radius=1609; state.sight=152; setManual(34.1366,-118.2942); });
  await pg.waitForTimeout(4000);
  await pg.click('#modeBtn'); await pg.waitForTimeout(9000);
  const st = await pg.evaluate(()=>({mode:state.mode, cls:document.documentElement.classList.contains('nature'), stored:localStorage.getItem('wander.mode'),
    items:[...state.items.values()].map(it=>(it.src||'wiki')+': '+Object.values(it.versions)[0].title+' ['+(it.facts||[]).join('; ')+']'),
    legend:[...document.querySelectorAll('.legend [data-src]')].filter(b=>!b.hidden).map(b=>b.textContent), hero:document.querySelector('#heroTitle')?.textContent,
    natureSub:document.querySelector('.card.nat .sub')?.textContent, theme:[...document.querySelectorAll('meta[name=theme-color]')].map(m=>m.content), status:document.querySelector('#status').textContent}));
  console.log(JSON.stringify(st,null,1));
  await pg.screenshot({path:SP+'/nat-1.png'});
  await pg.click('[data-act="areatoggle"][data-key="nature"]'); await pg.waitForTimeout(800);
  await pg.evaluate(()=>document.querySelector('#areaWrap').scrollIntoView()); await pg.waitForTimeout(400);
  await pg.screenshot({path:SP+'/nat-2.png'});
  await pg.evaluate(()=>document.querySelector('.layer:last-of-type').scrollIntoView()); await pg.waitForTimeout(300);
  await pg.screenshot({path:SP+'/nat-3.png'});
  await pg.evaluate(()=>{ const c=document.querySelectorAll('#listWrap .card'); c[0].scrollIntoView(); scrollBy(0,-60); }); await pg.waitForTimeout(300);
  await pg.screenshot({path:SP+'/nat-4.png'});
  // prompt
  await pg.click('#guideBtn'); await pg.waitForTimeout(300);
  const pr = await pg.evaluate(()=>({deep: document.querySelector('input[name=gDepth]:checked').value, prompt: document.querySelector('#gPrompt').value}));
  console.log('depth default in nature:', pr.deep); console.log(pr.prompt.split('\n').slice(0,4).join('\n').slice(0,600)); console.log('...KNOWS:', pr.prompt.split('WHAT MY APP ALREADY KNOWS')[1].split('REPLY')[0].slice(0,700));
  // import a nature guide while in history mode
  await pg.evaluate(()=>{ document.querySelector('#guide').open=false; });
  await pg.click('#modeBtn'); await pg.waitForTimeout(2500);
  console.log('back to history:', await pg.evaluate(()=>({mode:state.mode, cls:document.documentElement.classList.contains('nature'), natItems:[...state.items.values()].filter(it=>it.src==='OpenStreetMap').length, hero:document.querySelector('#heroTitle')?.textContent})));
  const guide = JSON.stringify({wander:1,mode:'nature',area:{name:'Griffith Park',lat:34.1366,lon:-118.2942,summary:'The park sits on a block of granite and Miocene marine rocks pushed up along the Hollywood fault.',keyPoints:['Granite core','Marine sandstone on the flanks'],timeline:[{date:'c. 80 million years ago',text:'Granite crystallises deep underground.'},{date:'c. 15 million years ago',text:'The Topanga sandstone is laid down on the sea floor.'}],species:[{name:'Coast live oak',scientific:'Quercus agrifolia',note:'The dominant native tree.',months:'All year'},{name:'Toyon',scientific:'Heteromeles arbutifolia',note:'Red berries in winter gave Hollywood its name.',months:'Dec–Feb'}],sources:[{title:'USGS OF 2005-1019',url:'https://pubs.usgs.gov/of/2005/1019/of2005-1019.pdf#page=12'}]},
    places:[{id:null,name:'Fern Dell spring line',kind:'Spring',lat:34.1300,lon:-118.2960,summary:'Water seeps out where the granite meets the sandstone.',seeToday:'Ferns along the trickle',sources:[{title:'x',url:'https://example.org'}],confidence:'medium'}]});
  await pg.evaluate(()=>{ openGuide(); });
  await pg.fill('#gImport', guide); await pg.click('#gImportBtn'); await pg.waitForTimeout(6000);
  console.log('after import:', await pg.$eval('#gMsg', e=>e.textContent), '| mode', await pg.evaluate(()=>state.mode), '| areaGuide', await pg.evaluate(()=>state.areaGuide && state.areaGuide.name), '| ai items', await pg.evaluate(()=>[...state.items.values()].filter(i=>i.src==='AI guide').length));
  await pg.evaluate(()=>{ document.querySelector('#guide').open=false; state.expanded.add('nature'); render(); document.querySelector('#areaWrap').scrollIntoView(); });
  await pg.waitForTimeout(500); await pg.evaluate(()=>{ const e=document.querySelector('.card.nat .more'); e && e.scrollIntoView(); scrollBy(0,-100); });
  await pg.screenshot({path:SP+'/nat-5.png'});
  // history mode should not show the nature guide
  await pg.click('#modeBtn'); await pg.waitForTimeout(2500);
  console.log('history shows nature guide?', await pg.evaluate(()=>[...state.items.values()].some(i=>i.src==='AI guide')), 'areaGuide', await pg.evaluate(()=>state.areaGuide && state.areaGuide.name));
  await pg.click('#modeBtn'); await pg.waitForTimeout(5000);
  await pg.evaluate(()=>saveSession()); await pg.reload(); await pg.waitForTimeout(1500);
  console.log('reload:', JSON.stringify(await pg.evaluate(()=>({mode:state.mode, cls:document.documentElement.classList.contains('nature'), natureRestored: !!(state.nature && state.nature.geo), items: state.items.size}))));
  console.log('hosts', JSON.stringify(hits)); console.log('errors', errs);
  await b.close();
})();
