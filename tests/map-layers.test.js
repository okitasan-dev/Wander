const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright'); const fs=require('fs');
const SP=OUT;
(async()=>{
  const b=await chromium.launch();
  for(const scheme of ['light','dark']){
  const pg=await b.newPage({viewport:{width:390,height:700}, deviceScaleFactor:2, colorScheme:scheme});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); const hits={};
  await pg.route(/^https?:\/\//, r=>{ const u=r.request().url();
    if(/cdnjs|fonts|tile\.openstreetmap/.test(u)) return r.continue();
    const k = /World_Imagery/.test(u)?'sat':/Reference\/World_Transportation/.test(u)?'roads':/World_Boundaries/.test(u)?'places':/opentopomap/.test(u)?'topo':null;
    if(k){ hits[k]=(hits[k]||0)+1; if(k==='topo') hits.topoHost=new URL(u).hostname; if(k==='sat') hits.satUrl=u.replace(/.*tile\//,'');
      return r.fulfill({status:200, contentType:'image/png', body:fs.readFileSync(`${FIX}/${k==='sat'?'t-sat':k==='topo'?'t-topo':'t-lbl'}.png`)}); }
    return r.abort(); });
  await pg.goto('file://'+ROOT+'/index.html'); await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ localStorage.removeItem('wander.mapLayer'); state.pos={lat:34.18172,lon:-118.31143}; state.manual=true; state.loading=false; state.lastLoadTime=Date.now(); render(); });
  await pg.waitForTimeout(1500);
  const shot = async n => { await pg.waitForTimeout(1200); await pg.screenshot({path:`${SP}/layer-${scheme}-${n}.png`, clip:{x:0,y:0,width:390,height:380}}); };
  await pg.click('#layerBtn'); await pg.waitForTimeout(200); await shot('menu');
  console.log(scheme, 'menu open:', !(await pg.$eval('#layerMenu', e=>e.hidden)));
  await pg.click('[data-layer="sat"]'); await shot('sat');
  console.log(' sat: menu closed', await pg.$eval('#layerMenu', e=>e.hidden), 'class', await pg.$eval('#map', e=>[...e.classList].filter(c=>c.startsWith('lay-')).join()), 'filter', await pg.$eval('#map .leaflet-tile-pane', e=>getComputedStyle(e).filter), 'attr', await pg.$eval('.leaflet-control-attribution', e=>e.textContent));
  await pg.click('#layerBtn'); await pg.click('[data-layer="topo"]'); await shot('topo');
  console.log(' topo filter', await pg.$eval('#map .leaflet-tile-pane', e=>getComputedStyle(e).filter), 'attr', await pg.$eval('.leaflet-control-attribution', e=>e.textContent));
  await pg.click('#layerBtn'); await pg.mouse.click(200, 600); await pg.waitForTimeout(100); console.log(' outside tap closes:', await pg.$eval('#layerMenu', e=>e.hidden));
  await pg.reload(); await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ state.pos={lat:34.18172,lon:-118.31143}; state.manual=true; state.loading=false; state.lastLoadTime=Date.now(); render(); }); await pg.waitForTimeout(800);
  console.log(' after reload layer:', await pg.$eval('#map', e=>[...e.classList].filter(c=>c.startsWith('lay-')).join()), 'tile imgs', await pg.$$eval('.leaflet-tile-pane img', is=>[...new Set(is.map(i=>new URL(i.src).hostname))].join()));
  await pg.click('#layerBtn'); await pg.click('[data-layer="street"]'); await pg.waitForTimeout(300);
  console.log(' street filter', await pg.$eval('#map .leaflet-tile-pane', e=>getComputedStyle(e).filter).then(f=>f.slice(0,50)), 'tile hosts', await pg.$$eval('.leaflet-tile-pane img', is=>[...new Set(is.map(i=>new URL(i.src).hostname))].join()));
  console.log(' hits', JSON.stringify(hits), 'errors', errs);
  await pg.close(); }
  await b.close();
})();
