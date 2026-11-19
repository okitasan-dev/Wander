const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright');
(async()=>{ const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2}); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:\/\//, r=>/cdnjs|fonts/.test(r.request().url())?r.continue():r.abort());
  await pg.goto('file://'+ROOT+'/index.html'); await pg.waitForTimeout(400);
  for(const id of ['settings','guide','lib']){
    await pg.evaluate(id=>{ document.querySelectorAll('details.sheet').forEach(s=>s.open=false); document.getElementById(id).open=true; }, id); await pg.waitForTimeout(200);
    const r = await pg.evaluate(id=>{ const g=document.querySelector('#'+id+' .grab').getBoundingClientRect(), body=document.querySelector('#'+id+' .sheet-body').getBoundingClientRect(); return {grabCentre: Math.round(g.left+g.width/2), sheetCentre: Math.round(body.left+body.width/2)}; }, id);
    if(id==='settings') await pg.screenshot({path:OUT+'/grab.png', clip:{x:0,y:120,width:390,height:140}});
    await pg.mouse.click(195, 40); await pg.waitForTimeout(150);
    console.log(id, JSON.stringify(r), 'closed by tap outside:', !(await pg.evaluate(id=>document.getElementById(id).open, id)));
  }
  console.log('errors', errs); await b.close(); })();
