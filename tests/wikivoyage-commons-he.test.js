const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright'); const SP=OUT;
const J=(r,body)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
const WIKITEXT = `==See==
* {{see | name=[[Westminster Abbey]] | alt= | url=https://www.westminster-abbey.org | lat=51.4994 | long=-0.1273 | content=The '''coronation church''' since 1066, with the graves of kings and poets.}}
* {{see | name=Jewel Tower | lat=51.4985 | long=-0.1262 | content=A surviving 14th-century part of the medieval Palace of Westminster, built to hold [[Edward III|Edward III's]] treasure.}}
* {{listing | type=see | name=Blewcoat School | lat=51.4987 | long=-0.1351 | content=Charity school of 1709, now a shop.}}
* {{see | name=Marsham Street Mosaic Bench | lat=51.4960 | long=-0.1290 | content=A mosaic bench few visitors notice.}}
* {{eat | name=Some café | lat=51.5 | long=-0.13 | content=Coffee.}}
* {{do | name=River cruise | lat=51.5007 | long=-0.1218 | content=Boats from the pier.}}`;
const COMMONS = {query:{pages:[
  {pageid:1,title:'File:Westminster Abbey 1890.jpg',index:2,coordinates:[{lat:51.4994,lon:-0.1272}],imageinfo:[{thumburl:'https://upload.wikimedia.org/x/250px-a.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:a.jpg',extmetadata:{DateTimeOriginal:{value:'1890'},ObjectName:{value:'Westminster Abbey, west front'},Artist:{value:'<a>Unknown</a>'}}}]},
  {pageid:2,title:'File:Jewel Tower 2019.jpg',index:1,coordinates:[{lat:51.49852,lon:-0.12621}],imageinfo:[{thumburl:'https://upload.wikimedia.org/x/250px-b.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:b.jpg',extmetadata:{DateTimeOriginal:{value:'2019:05:01 10:00:00'},ObjectName:{value:'Jewel Tower, Westminster'}}}]},
  {pageid:3,title:'File:Parliament Square.jpg',index:3,coordinates:[{lat:51.5,lon:-0.127}],imageinfo:[{thumburl:'https://upload.wikimedia.org/x/250px-c.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:c.jpg',extmetadata:{DateTimeOriginal:{value:'2012-06-01'}}}]}]}};
(async()=>{ const srv = await require('./serve.js')(8779); const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'}); const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:\/\//, r=>{ const u=new URL(r.request().url()), h=u.hostname, sp=u.searchParams;
    if(/localhost|cdnjs|fonts|query\.wikidata\.org|tile\.openstreetmap|nominatim|services-eu1\.arcgis\.com/.test(h)) return r.continue();
    if(/wikivoyage/.test(h)){ if(sp.get('list')==='geosearch') return J(r,{query:{geosearch:[{title:'London/Westminster',dist:300}]}}); return J(r,{query:{pages:[{title:'London/Westminster',revisions:[{slots:{main:{content:WIKITEXT}}}]}]}}); }
    if(h==='commons.wikimedia.org') return J(r,COMMONS);
    if(h==='upload.wikimedia.org') return r.fulfill({status:200,contentType:'image/jpeg',body:require('fs').readFileSync(FIX+'/sp2.jpg')});
    if(h==='www.wikidata.org') return J(r,{entities:{}});
    if(h==='en.wikipedia.org'){ if(sp.get('generator')==='geosearch') return J(r,{query:{pages:[{title:'Westminster Abbey',extract:'Westminster Abbey is a church (stand-in).',fullurl:'https://en.wikipedia.org/wiki/Westminster_Abbey',coordinates:[{lat:51.4994,lon:-0.1273}],pageprops:{wikibase_item:'Q5933'}}]}}); return J(r,{query:{pages:[]}}); }
    if(/overpass/.test(h)) return J(r,{elements:[]});
    return J(r,{}); });
  await pg.goto('http://localhost:8779/index.html'); await pg.evaluate(()=>{ localStorage.clear(); localStorage.setItem('wander.radius','805'); }); await pg.reload(); await pg.waitForTimeout(300);
  await pg.evaluate(()=>setManual(51.4993,-0.1273));
  await pg.waitForFunction(()=>!state.loading && state.lastLoadTime>0, null, {timeout:90000}); await pg.waitForTimeout(3000);
  const r = await pg.evaluate(()=>{ const its=[...state.items.values()];
    return {cc: state.cc, he: its.filter(i=>i.src==='Historic England').length, heSample: its.filter(i=>i.src==='Historic England').slice(0,6).map(i=>Object.values(i.versions)[0].title+' ['+i.facts.join('; ')+']'),
      abbey: (()=>{ const a=state.items.get('Q5933'); return a && {facts:a.facts, heLink:!!a.heLink, voyText:a.voyText, thumb:a.thumb}; })(),
      voy: its.filter(i=>i.src==='Wikivoyage').map(i=>Object.values(i.versions)[0].title+' | '+Object.values(i.versions)[0].extract.slice(0,60)),
      jewelThumb: (its.find(i=>Object.values(i.versions)[0].title==='Jewel Tower')||{}).thumb,
      photos: state.photos && state.photos.list.map(p=>`${p.title} (${p.year})`), legend:[...document.querySelectorAll('.legend [data-src]')].filter(b=>!b.hidden).map(b=>b.textContent)}; });
  console.log(JSON.stringify(r, null, 1));
  await pg.evaluate(()=>{ state.expanded.add('Q5933'); render(); document.querySelector('[data-key="Q5933"]').scrollIntoView(); scrollBy(0,-60); }); await pg.waitForTimeout(600);
  console.log('abbey card:', await pg.evaluate(()=>document.querySelector('[data-key="Q5933"]').innerText.replace(/\n+/g,' | ').slice(0,500)));
  await pg.screenshot({path:SP+'/src-abbey.png'});
  console.log('errors', errs); await b.close(); srv.close && srv.close(); process.exit(0); })();
