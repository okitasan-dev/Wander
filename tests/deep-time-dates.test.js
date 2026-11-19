const {ROOT, FIX, OUT} = require('./paths');
const {chromium}=require('playwright');
(async()=>{ const b=await chromium.launch(); const pg=await b.newPage(); await pg.route(/^https?:/, r=>r.abort());
  await pg.goto('file://'+ROOT+'/index.html'); await pg.waitForTimeout(300);
  console.log(await pg.evaluate(()=>{ const out=[]; for(const t of ['c. 15 million years ago','2.6 Ma','c. 12,000 years ago','約1万年前','1938','c. 80 million years ago','8000 BC','12th century','about 4.5 billion years ago','In 1066 the abbey','Cenozoic, 66 million years']) out.push(t.padEnd(30)+JSON.stringify(yearOf(t)));
    out.push(byDate([{date:'1938',text:'a'},{date:'c. 15 million years ago',text:'b'},{date:'c. 12,000 years ago',text:'c'},{date:'c. 80 million years ago',text:'d'},{date:'8000 BC',text:'e'}]).map(x=>x.date).join(' | ')); return out.join('\n'); }));
  await b.close(); })();
