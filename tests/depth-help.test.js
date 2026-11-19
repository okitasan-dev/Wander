const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright');
const SP=OUT;
(async()=>{
  const b=await chromium.launch(), pg=await b.newPage({viewport:{width:390,height:844}, deviceScaleFactor:2});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:\/\//, r=>/cdnjs|fonts/.test(r.request().url())?r.continue():r.abort());
  await pg.goto('file://'+ROOT+'/index.html'); await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ state.pos={lat:34.18,lon:-118.31}; });
  await pg.click('#guideBtn'); await pg.waitForTimeout(200);
  console.log('hidden at first:', await pg.$eval('#depthHelp', e=>e.hidden));
  await pg.click('#depthHelpBtn'); await pg.waitForTimeout(150);
  await pg.check('input[name="gRadius"][value="8047"]'); await pg.waitForTimeout(100);
  console.log(await pg.$eval('#depthHelp', e=>e.hidden + ' | ' + e.innerText));
  await pg.evaluate(()=>document.querySelector('#depthHelpBtn').scrollIntoView({block:'start'})); await pg.evaluate(()=>document.querySelector('#guide .sheet-body').scrollBy(0,-120));
  await pg.screenshot({path:SP+'/help.png'});
  await pg.click('#depthHelpBtn'); console.log('closed again:', await pg.$eval('#depthHelp', e=>e.hidden), 'errors', errs);
  await b.close();
})();
