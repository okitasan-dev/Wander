const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright');
(async()=>{ const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2}); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:\/\//, r=>{ const u=r.request().url(); if(/cdnjs|fonts/.test(u)) return r.continue();
    const J=b=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(b)});
    if(/wbgetentities/.test(u)) return J({entities:{Q1132396:{id:'Q1132396',labels:{en:{value:'Mount Hollywood'}},descriptions:{en:{value:'summit in Los Angeles'}},claims:{},sitelinks:{}}}});
    if(/sparql/.test(u)) return J({results:{bindings:[]}});
    if(/wikipedia/.test(u)) return J({query:{pages:[]}});
    return r.abort(); });
  await pg.goto('file://'+ROOT+'/index.html'); await pg.waitForTimeout(300);
  await pg.evaluate(()=>{ localStorage.clear(); localStorage.setItem('wander.mode','"nature"'); addGuide(normalizeGuide({mode:'nature',area:{name:'Griffith Park',lat:34.13,lon:-118.29,summary:'x'},places:[{id:'Q1132396',name:'Mount Hollywood',lat:34.128,lon:-118.30,summary:'A granite and sandstone summit.',keyPoints:['Highest point of the park trails'],
    timeline:[{date:'1938',text:'The trail to the top is graded by WPA crews.'},{date:'c. 80 million years ago',text:'Granite crystallises deep underground.'},{date:'c. 15 million years ago',text:'Marine sandstone is laid down over it.'},{date:'c. 10,000 years ago',text:'Tongva people use the ridge routes.'}],trivia:['On clear days you can see Catalina Island.'],sources:[{title:'USGS',url:'https://pubs.usgs.gov/of/2005/1019/'}]}]})); });
  await pg.goto('file://'+ROOT+'/place.html?id=Q1132396&lang=en&t=Mount%20Hollywood'); await pg.waitForTimeout(4000);
  console.log('nature class:', await pg.evaluate(()=>document.documentElement.classList.contains('nature')));
  console.log(await pg.evaluate(()=>{ const g=document.querySelector('#guideSec'); return g ? g.innerText.slice(0,600) : 'no guide section; page: '+document.body.innerText.slice(0,300); }));
  await pg.evaluate(()=>document.querySelector('#guideSec')?.scrollIntoView()); await pg.waitForTimeout(300); await pg.screenshot({path:OUT+'/place-tl.png'});
  console.log('errors', errs); await b.close(); })();
