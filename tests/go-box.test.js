const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(), pg=await b.newPage({viewport:{width:390,height:844}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const calls=[];
  await pg.route(/^https?:\/\//, r=>{
    const u=new URL(r.request().url());
    if(/cdnjs|fonts/.test(u.hostname)) return r.continue();
    if(u.hostname==='nominatim.openstreetmap.org' && u.pathname==='/search'){
      const q=u.searchParams.get('q'); calls.push('nomi:'+q+(u.searchParams.get('viewbox')?' [box]':''));
      const hit = /^1600 Pennsylvania Ave NW, Washington/.test(q) && !/Suite/.test(q) ? [{lat:'38.8977',lon:'-77.0365'}] : /Burbank Town Center/.test(q) ? [{lat:'34.1847',lon:'-118.3103'}] : /Golden Gate/.test(q) ? [{lat:'37.8199',lon:'-122.4783'}] : [];
      return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(hit)});
    }
    if(u.hostname==='photon.komoot.io'){ calls.push('photon:'+u.searchParams.get('q'));
      const hit = /olive av/i.test(u.searchParams.get('q')) ? [{geometry:{coordinates:[-118.309,34.181]}}] : [];
      return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({features:hit})}); }
    return r.abort();
  });
  await pg.goto('file://'+ROOT+'/index.html'); await pg.waitForTimeout(500);
  const unit = await pg.evaluate(()=>{
    const L = [
      'https://www.google.com/maps/place/Westminster+Abbey/@51.4993,-0.1295,17z/data=!3m1!4b1!4m6!3m5!1s0x4876!8m2!3d51.4992921!4d-0.1272622!16zL20vMDgzNTI',
      'https://www.google.com/maps/@34.1817,-118.3114,15z',
      'https://www.google.com/maps/search/34.18172,+-118.31143?entry=tts',
      'https://www.google.com/maps?q=34.18172,-118.31143',
      'https://maps.google.com/?q=Burbank+Town+Center',
      'https://www.google.com/maps/search/?api=1&query=34.18172%2C-118.31143',
      'https://www.google.com/maps/place/Golden+Gate+Bridge/',
      'https://www.google.com/maps/dir/?api=1&destination=35.0037,135.7788',
      'https://maps.apple.com/?ll=35.0037,135.7788&q=Gion',
      'https://maps.apple.com/place?coordinate=35.0037,135.7788&name=Gion',
      'https://maps.apple.com/?address=1600%20Pennsylvania%20Ave%20NW,%20Washington,%20DC',
      'https://www.openstreetmap.org/?mlat=35.0037&mlon=135.7788#map=17/35.0037/135.7788',
      'https://www.openstreetmap.org/#map=17/35.0037/135.7788',
      'https://ul.waze.com/ul?ll=34.1817%2C-118.3114&navigate=yes',
      'https://maps.app.goo.gl/AbCdEf123?g_st=ic',
      'https://goo.gl/maps/xyz',
    ].map(x=>[x.slice(0,60), JSON.stringify(fromMapLink(x))]);
    const C = ['34.18172, -118.31143','34.18172 -118.31143','34°10\'54.2"N 118°18\'41.1"W','51°29′57″N 0°7′38″W','34.1817° N, 118.3114° W','35.0037N 135.7788E',
      '100 N 200 E, Salt Lake City','1600 Pennsylvania Ave NW','221B Baker Street, London','Apt 12 345 Main'].map(x=>[x, JSON.stringify(coordsIn(x))]);
    return [...L, ...C];
  });
  unit.forEach(u=>console.log(u[0].padEnd(62), u[1]));
  async function go(v){ calls.length=0;
    await pg.evaluate(()=>{ document.querySelector('#settings').open=true; });
    await pg.fill('#placeInput', v); await pg.click('#placeForm button[type=submit]'); await pg.waitForTimeout(3500);
    const r = await pg.evaluate(()=>({pos: state.pos && [+state.pos.lat.toFixed(4), +state.pos.lon.toFixed(4)], status: document.querySelector('#status').hidden ? '' : document.querySelector('#status').textContent.slice(0,90), settingsOpen: document.querySelector('#settings').open}));
    console.log('GO', JSON.stringify(v).slice(0,70), '->', JSON.stringify(r), calls.join(' | '));
  }
  await go('1600 Pennsylvania Ave NW, Suite 200, Washington, DC');
  await go('Burbank Town Center\nhttps://maps.app.goo.gl/AbCdEf123?g_st=ic');
  await go('https://maps.app.goo.gl/AbCdEf123?g_st=ic');
  await pg.screenshot({path:OUT+'/go-short.png'});
  await go('150 olive av burbnk');
  await go('https://www.google.com/maps/place/Golden+Gate+Bridge/');
  await go('asdfghjkl qwerty');
  await pg.screenshot({path:OUT+'/go-fail.png'});
  console.log('errors', errs);
  await b.close();
})();
