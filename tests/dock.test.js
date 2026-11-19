const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright');
const SP=OUT;
(async()=>{
  const b=await chromium.launch();
  for(const scheme of ['light','dark']){
  const pg=await b.newPage({viewport:{width:390,height:400}, deviceScaleFactor:2, colorScheme:scheme});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:\/\//, r=>/cdnjs|fonts/.test(r.request().url())?r.continue():r.abort());
  await pg.goto('file://'+ROOT+'/index.html'); await pg.waitForTimeout(400);
  await pg.locator('.dock').screenshot({path:`${SP}/dock-${scheme}-1.png`});
  await pg.evaluate(()=>{ label('#gpsBtn','Following'); const g=document.querySelector('#gpsBtn'); g.classList.add('on'); g.classList.remove('primary'); document.querySelector('#lookBtn').classList.add('on'); });
  await pg.evaluate(()=>document.getAnimations().forEach(a=>a.pause()));
  await pg.locator('.dock').screenshot({path:`${SP}/dock-${scheme}-2.png`});
  await pg.click('#guideBtn'); await pg.waitForTimeout(200);
  console.log(scheme, 'guide open after tap:', await pg.$eval('#guide', e=>e.open), 'gps label:', await pg.$eval('#gpsBtn', e=>e.getAttribute('aria-label')), 'errors', errs);
  await pg.close(); }
  await b.close();
})();
