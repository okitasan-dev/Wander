const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright'); const fs=require('fs');
const SP=OUT;
(async()=>{
  const b=await chromium.launch(), pg=await b.newPage({viewport:{width:390,height:844}, deviceScaleFactor:2});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:\/\//, r=>/cdnjs|fonts|tile\.openstreetmap/.test(r.request().url())?r.continue():r.abort());
  await pg.goto('file://'+ROOT+'/index.html'); await pg.waitForTimeout(400);
  const g=fs.readFileSync(FIX+'/burbank.json','utf8');
  const out = await pg.evaluate(g=>{
    localStorage.clear(); state.pos={lat:34.18172,lon:-118.31143}; state.manual=true; state.langs=['en']; state.place='Burbank'; state.loading=false; state.lastLoadTime=Date.now();
    addGuide(decodeGuidePayload(g));
    const mk=(k,src,dlat)=>state.items.set(k,{key:k,src,lat:34.18172+dlat,lon:-118.31143,versions:{en:{title:k,extract:'x',url:'#'}},facts:[]});
    mk('w1',undefined,.001); mk('w2',undefined,.002); mk('o1','OpenStreetMap',.0015); mk('d1','Wikidata',.003); mk('d2','Wikidata',.0035); mk('d3','Wikidata',.004);
    render();
    const chips = () => [...document.querySelectorAll('.legend [data-src]')].filter(b=>!b.hidden).map(b=>b.textContent+(b.getAttribute('aria-pressed')==='false'?' (hidden)':''));
    const a = chips(); setHiddenSrc(new Set(['wd'])); const b2 = chips(); return {a, b:b2};
  }, g);
  console.log(JSON.stringify(out,null,1));
  await pg.evaluate(()=>document.querySelector('.legend').scrollIntoView({block:'center'}));
  const box = await pg.$eval('.legend', e=>{ const r=e.getBoundingClientRect(); return {x:0,y:r.y-10,width:390,height:r.height+60}; });
  await pg.screenshot({path:SP+'/count.png', clip:box});
  console.log('errors', errs); await b.close();
})();
