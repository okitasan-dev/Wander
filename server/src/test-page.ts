// A tiny page served at "/" so you can try the backend from your phone without the full app.
export const TEST_PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Wander Guide Test</title>
<style>
:root{--ground:#E6E9E4;--surface:#F3F4F0;--ink:#132A2C;--muted:#5B6D6C;--rule:rgba(19,42,44,.13);--brass:#8A672B;--on-brass:#FFF9EC;--bad:#A33A2B}
@media (prefers-color-scheme:dark){:root{--ground:#0C2123;--surface:#122D30;--ink:#E8EEE7;--muted:#8FA7A3;--rule:rgba(232,238,231,.11);--brass:#D0AE70;--on-brass:#1E180B;--bad:#F08A7A}}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font:400 17px/1.6 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;padding:24px 16px 48px}
main{max-width:620px;margin:0 auto}
h1{font:italic 500 30px/1.1 Didot,Georgia,serif;margin:0 0 4px}
.sub{color:var(--muted);font-size:14px;margin:0 0 20px}
button{font:inherit;font-weight:600;border:0;border-radius:999px;padding:13px 20px;cursor:pointer;background:var(--brass);color:var(--on-brass)}
button.ghost{background:transparent;color:var(--ink);border:1px solid var(--rule);font-weight:500;font-size:14px;padding:8px 14px}
button:disabled{opacity:.5}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
label{font-size:14px;color:var(--muted);display:flex;gap:6px;align-items:center}
#status{font-size:14px;color:var(--muted);min-height:1.6em;margin:16px 0 8px}
#status.err{color:var(--bad)}
#story{background:var(--surface);border:1px solid var(--rule);border-radius:14px;padding:18px;white-space:pre-wrap;min-height:120px}
#story:empty{display:none}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:24px 0 8px}
ol{padding-left:20px;margin:0;font-size:14px}
li{margin:4px 0;overflow-wrap:anywhere}
a{color:var(--brass)}
</style>
</head>
<body>
<main>
  <h1>Wander Guide</h1>
  <p class="sub">Backend test page. Tap the button where you're standing, or try a famous spot.</p>
  <div class="row">
    <button id="here">Tell me about where I am</button>
  </div>
  <div class="row">
    <button class="ghost" data-lat="41.8902" data-lon="12.4922">Colosseum, Rome</button>
    <button class="ghost" data-lat="51.5081" data-lon="-0.0759">Tower of London</button>
    <button class="ghost" data-lat="40.7061" data-lon="-73.9969">Brooklyn Bridge</button>
  </div>
  <label><input type="checkbox" id="speak" checked> Read it aloud</label>
  <div id="status"></div>
  <div id="story"></div>
  <div id="srcWrap" hidden><h2>Sources</h2><ol id="sources"></ol></div>
</main>
<script>
const $ = (s) => document.querySelector(s);
const status = (msg, err) => { $('#status').textContent = msg; $('#status').className = err ? 'err' : ''; };
const synth = window.speechSynthesis;
let pending = '';

function say(text) {
  if (!synth || !$('#speak').checked || !text.trim()) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = navigator.language || 'en';
  synth.speak(u);
}
// Speak each finished sentence as it arrives, so you don't wait for the whole story.
function feedSpeech(chunk, flush) {
  pending += chunk;
  const parts = pending.split(/(?<=[.!?])\\s+/);
  pending = flush ? '' : parts.pop();
  parts.forEach(say);
}

async function tour(lat, lon) {
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  synth && synth.cancel();
  say('Let me look into this spot.');   // also unlocks speech on iPhone
  $('#story').textContent = ''; $('#sources').innerHTML = ''; $('#srcWrap').hidden = true; pending = '';
  status('Researching… this usually takes 20–60 seconds the first time.');
  try {
    const res = await fetch('/tour', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lat, lon, lang: (navigator.language || 'en').slice(0, 2).toLowerCase() }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'HTTP ' + res.status); }
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const events = buf.split('\\n\\n'); buf = events.pop();
      for (const ev of events) {
        if (!ev.startsWith('data: ')) continue;
        const msg = JSON.parse(ev.slice(6));
        if (msg.type === 'text') { $('#story').textContent += msg.text; feedSpeech(msg.text); status('Writing…'); }
        if (msg.type === 'sources' && msg.sources.length) {
          $('#srcWrap').hidden = false;
          for (const s of msg.sources) {
            const li = document.createElement('li'), a = document.createElement('a');
            a.href = s.url; a.textContent = s.title; a.target = '_blank'; a.rel = 'noopener';
            li.appendChild(a); $('#sources').appendChild(li);
          }
        }
        if (msg.type === 'done') { feedSpeech('', true); status(msg.cached ? 'Done (from cache, free).' : 'Done.'); }
        if (msg.type === 'error') throw new Error(msg.message);
      }
    }
  } catch (e) {
    status('Problem: ' + e.message, true);
  } finally {
    document.querySelectorAll('button').forEach(b => b.disabled = false);
  }
}

$('#here').onclick = () => {
  if (!navigator.geolocation) return status('This browser has no location access.', true);
  status('Finding you…');
  navigator.geolocation.getCurrentPosition(
    (p) => tour(p.coords.latitude, p.coords.longitude),
    (e) => status('Location error: ' + e.message, true),
    { enableHighAccuracy: true, timeout: 15000 });
};
document.querySelectorAll('[data-lat]').forEach(b => b.onclick = () => tour(+b.dataset.lat, +b.dataset.lon));
</script>
</body>
</html>`;
