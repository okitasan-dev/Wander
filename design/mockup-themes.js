// Mockup themes (not used by the app yet): CSS overrides for palettes A–F, kept for the future theme picker. See CLAUDE.md.
// Three looks for Wander in the "Tuscan sunset" palette: #E35336 coral, #FFD3AC peach, #9988A1 lavender, #8A2B0E rust.
const FONTS_A = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Manrope:wght@400..700&display=swap';
const FONTS_B = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:opsz,wght@9..40,400..700&display=swap';

// Shared modern touches: rounded cards with soft warm shadows, roomier spacing, refined chips and dock
const cardsAsTiles = `
.card{margin:0 14px 12px;border:0!important;border-radius:22px;background:var(--raise);padding:18px 18px 16px;
  box-shadow:0 1px 2px rgba(46,23,18,.05),0 12px 30px rgba(138,43,14,.07)}
.card.area{margin:0 14px 12px;padding:22px 20px 18px}
.card.area.secondary{padding-top:20px}
h2{padding:28px 22px 12px}
h2.band b{font-weight:600;letter-spacing:-.01em}
h2.band span{font-size:12px}
.card h3{letter-spacing:-.015em}
.card .meta{font-weight:600}
.facts span{border-radius:999px;padding:3px 10px;background:var(--surface);border-color:transparent}
.actions{gap:6px 8px;margin-top:16px}
.actions button,.actions a{padding:6px 12px;border-radius:999px;background:var(--surface)}
.legend{padding:12px 14px 14px}
.legend button{border:0;background:var(--raise);box-shadow:0 1px 2px rgba(46,23,18,.06)}
.dock{border:0;border-radius:26px;box-shadow:0 14px 40px rgba(138,43,14,.22)}
.dock button{border-radius:20px}
.pin{width:30px;height:30px}
.hero h1{font-size:46px;letter-spacing:-.025em;line-height:1.02}
#mapWrap{border-bottom:0}
`;

const A = { name: 'A · Terracotta', fonts: FONTS_A, css: `
:root{--ground:#FBF3EA;--surface:#F5E7DB;--raise:#FFFCF9;--ink:#2E1712;--muted:#86706B;--rule:rgba(138,43,14,.12);
  --brass:#8A2B0E;--brass-hi:#E35336;--brass-soft:rgba(227,83,54,.09);--on-brass:#FFF7F0;--patina:#9988A1;--you:#9988A1;
  --shadow:0 14px 36px rgba(138,43,14,.14);--serif:"Fraunces",Georgia,serif;--sans:"Manrope",system-ui,sans-serif}
body{font-family:var(--sans)}
${cardsAsTiles}
.wiki{background:#E35336;color:#FFF7F0}
.osm{background:#9988A1;color:#fff;box-shadow:none}
.wd{background:#8A2B0E;color:#FFD3AC;box-shadow:none}
.ai{background:#FFF7F0;color:#E35336;box-shadow:inset 0 0 0 2px #E35336}
.pin,.pin.osm,.pin.wd{box-shadow:0 0 0 3px #FFFCF9,0 5px 12px rgba(138,43,14,.28)}
.dock{background:rgba(255,252,249,.86)}
.dock button.primary{background:#E35336;color:#FFF7F0}
.dock button.on{background:rgba(227,83,54,.1);color:#C2401F}
.card .meta,.timeline .yr,.tl-card b,.ev-date{color:#C2401F}
.card h3,.card.area h3,h1,.hero h1{font-variation-settings:"SOFT" 50,"WONK" 0}
#map .leaflet-tile-pane{filter:grayscale(.9) sepia(.32) saturate(1.25) hue-rotate(-10deg) brightness(1.04) contrast(.9)}
.links a,.links button{background:#FFFCF9;border-color:rgba(138,43,14,.14)}
.home{font-family:var(--serif)}
.tl{background:#F5E7DB}
.tl-card{border:0;box-shadow:0 6px 16px rgba(138,43,14,.12)}
.tl-dot{background:#E35336}
.see{background:rgba(255,211,172,.45)}
`};

const B = { name: 'B · Golden hour', fonts: FONTS_B, css: `
:root{--ground:#FFF5EC;--surface:#FFE7D3;--raise:#FFFFFF;--ink:#3A140A;--muted:#8D6F69;--rule:rgba(138,43,14,.14);
  --brass:#8A2B0E;--brass-hi:#E35336;--brass-soft:rgba(255,211,172,.5);--on-brass:#FFF5EC;--patina:#9988A1;--you:#8A2B0E;
  --shadow:0 14px 36px rgba(138,43,14,.18);--serif:"DM Serif Display",Georgia,serif;--sans:"DM Sans",system-ui,sans-serif}
body{font-family:var(--sans)}
.card h3,.card.area h3,h2.band b,.hero h1,h1,.sheet-body h3,.factgrid dd,.timeline .yr,.tl-card b,.ev-date,.ev-body h3,.look-head b,.look li .t{font-weight:400!important}
#areaWrap{background:#FFD3AC;border-radius:0 0 34px 34px;padding-bottom:6px;margin-bottom:6px}
#areaWrap h2{color:#8A2B0E;letter-spacing:.14em;text-transform:uppercase;font-size:11px}
#areaWrap .card.area{background:transparent;border:0}
#areaWrap .actions button,#areaWrap .actions a{color:#8A2B0E}
h2.band{padding-top:30px}
h2.band b{font-size:24px;color:#8A2B0E}
h2.band span{letter-spacing:.08em;text-transform:uppercase;font-size:10.5px}
.card{border-top:1px solid rgba(138,43,14,.12)}
.card h3{font-size:23px}
.num,.pin{border-radius:9px}
.wiki{background:#E35336;color:#fff}
.osm{background:#9988A1;color:#fff;box-shadow:none}
.wd{background:#8A2B0E;color:#FFD3AC;box-shadow:none}
.ai{background:#FFD3AC;color:#8A2B0E;box-shadow:inset 0 0 0 2px #8A2B0E}
.pin,.pin.osm,.pin.wd{box-shadow:0 0 0 3px #fff,0 4px 10px rgba(58,20,10,.3)}
.card .meta{color:#E35336}
.actions button,.actions a{color:#8A2B0E;font-weight:600}
.dock{background:#8A2B0E;border:0;border-radius:24px;box-shadow:0 16px 40px rgba(58,20,10,.35)}
.dock button{color:#FFD3AC}
.dock button.primary{background:#E35336;color:#fff}
.dock button.on{background:rgba(255,211,172,.16);color:#FFD3AC}
.legend button{background:#fff;border-color:rgba(138,43,14,.14)}
#map .leaflet-tile-pane{filter:grayscale(1) sepia(.45) saturate(1.4) hue-rotate(-12deg) brightness(1.02) contrast(.92)}
.hero h1{font-size:50px;line-height:1;letter-spacing:-.01em;color:#8A2B0E}
.head{background:#FFD3AC;padding-bottom:20px;border-radius:0 0 30px 30px}
.head h1{color:#3A140A}
.when{color:#8A2B0E}
.links a,.links button{background:rgba(255,255,255,.6);border:0}
.tl{background:#FFE7D3}
.tl-card{border-radius:10px}
.see{background:#FFE7D3}
`};

const C = { name: 'C · Dusk', fonts: FONTS_A, css: `
:root{--ground:#1F1210;--surface:#2B1914;--raise:#35211A;--ink:#FCE8D8;--muted:#BCA3A0;--rule:rgba(255,211,172,.12);
  --brass:#FFD3AC;--brass-hi:#FFB892;--brass-soft:rgba(227,83,54,.16);--on-brass:#2A120A;--patina:#9988A1;--you:#FFD3AC;
  --shadow:0 16px 40px rgba(0,0,0,.55);--serif:"Fraunces",Georgia,serif;--sans:"Manrope",system-ui,sans-serif}
html,body{background:#1F1210;color:#FCE8D8}
body{font-family:var(--sans)}
${cardsAsTiles}
.card{box-shadow:0 1px 0 rgba(255,211,172,.05) inset,0 14px 34px rgba(0,0,0,.35)}
.wiki{background:#E35336;color:#fff}
.osm{background:#9988A1;color:#1F1210;box-shadow:none}
.wd{background:#8A2B0E;color:#FFD3AC;box-shadow:none}
.ai{background:#1F1210;color:#FFD3AC;box-shadow:inset 0 0 0 2px #FFD3AC}
.pin,.pin.osm,.pin.wd{box-shadow:0 0 0 3px #1F1210,0 5px 12px rgba(0,0,0,.5)}
.card .meta,.timeline .yr,.tl-card b,.ev-date{color:#FF8F6B}
.dock{background:rgba(53,33,26,.88)}
.dock button.primary{background:#E35336;color:#fff}
.dock button.on{background:rgba(227,83,54,.18);color:#FFB892}
#map .leaflet-tile-pane{filter:invert(1) hue-rotate(185deg) sepia(.55) saturate(.9) brightness(.62) contrast(1.1)}
#map{background:#2B1914}
.legend button{background:#35211A}
.links a,.links button{background:#35211A;border-color:rgba(255,211,172,.12);color:#FCE8D8}
.tl{background:#2B1914}
.tl-card{border:0;background:#35211A}
.home{background:rgba(31,18,16,.75);color:#FCE8D8}
.see{background:rgba(227,83,54,.14)}
`};
// ---- "Stormy morning": #6A89A7 slate, #BDDDFC mist, #88BDF2 sky, #384959 storm ----
const FONTS_D = 'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400..700&family=Inter:wght@400..700&display=swap';
const FONTS_E = 'https://fonts.googleapis.com/css2?family=Geist:wght@400..700&display=swap';

// Minimal: no boxes, just generous space and hairlines
const hairline = `
.card{margin:0 22px;padding:22px 0 22px;border-top:1px solid var(--rule)}
.card.inview{margin:0;padding-left:22px;padding-right:22px}
.card.area{padding-top:6px}
h2{padding-left:22px;padding-right:22px}
h2.band{padding-top:40px;padding-bottom:6px}
h2.band b{font-weight:500;letter-spacing:-.01em;font-size:22px;white-space:nowrap}
h2.band{gap:16px}
h2.band span{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;text-align:right}
.card h3{font-weight:500;letter-spacing:-.015em}
.card.area h3{font-weight:500;font-size:36px;letter-spacing:-.025em;line-height:1.05}
.card .meta{font-weight:600;font-size:12.5px;letter-spacing:.01em}
.facts span{border-radius:999px;padding:3px 10px}
.actions{gap:6px 20px;margin-top:16px}
.actions button,.actions a{font-size:13px;font-weight:600;letter-spacing:.01em}
.legend{padding:14px 18px 6px}
.legend button{background:transparent}
.dock{border-radius:20px}
.dock button{border-radius:14px}
.pin{width:28px;height:28px}
.num{font-weight:600}
.timeline .yr{font-weight:500}
.hero h1,.head h1{font-weight:500;letter-spacing:-.025em}
.tl-card{border-radius:8px}
#mapWrap{border-bottom:0}
`;

const D = { name: 'D · Slate', fonts: FONTS_D, css: `
:root{--ground:#F7FAFD;--surface:#EDF3F9;--raise:#FFFFFF;--ink:#1E2A36;--muted:#6B7C8D;--rule:rgba(56,73,89,.12);
  --brass:#384959;--brass-hi:#6A89A7;--brass-soft:rgba(136,189,242,.14);--on-brass:#F7FAFD;--patina:#6A89A7;--you:#88BDF2;
  --shadow:0 12px 32px rgba(56,73,89,.12);--serif:"Newsreader",Georgia,serif;--sans:"Inter",system-ui,sans-serif}
body{font-family:var(--sans)}
${hairline}
.card h3,.card.area h3,h2.band b,.hero h1,h1,.timeline .yr,.tl-card b{font-variation-settings:"opsz" 48}
.card .meta,.timeline .yr,.tl-card b,.ev-date{color:#B8692A}
.card.inview::before{background:#D98E4A}
.wiki{background:#384959;color:#fff}
.osm{background:#88BDF2;color:#1E2A36;box-shadow:none}
.wd{background:#6A89A7;color:#fff;box-shadow:none}
.ai{background:#fff;color:#B8692A;box-shadow:inset 0 0 0 2px #D98E4A}
.pin,.pin.osm,.pin.wd{box-shadow:0 0 0 2.5px #fff,0 3px 8px rgba(30,42,54,.25)}
.dock{background:rgba(255,255,255,.82);backdrop-filter:blur(14px);border:1px solid rgba(56,73,89,.1);box-shadow:0 10px 30px rgba(30,42,54,.12)}
.dock button.primary{background:#384959;color:#fff}
.dock button.on{background:rgba(136,189,242,.2);color:#384959}
#map .leaflet-tile-pane{filter:grayscale(1) sepia(.2) hue-rotate(170deg) saturate(1.5) brightness(1.05) contrast(.85)}
.links a,.links button{background:transparent;border-color:rgba(56,73,89,.18)}
.tl{background:#EDF3F9}
.tl-card{border:0;box-shadow:0 4px 12px rgba(56,73,89,.12)}
.tl-dot{background:#384959}
.tl-card .more{background:#D98E4A;color:#fff}
.see{background:#EDF3F9}
`};

const E = { name: 'E · Overcast', fonts: FONTS_E, css: `
:root{--ground:#F3F8FD;--surface:#E4EFFA;--raise:#FFFFFF;--ink:#1B2733;--muted:#62778B;--rule:rgba(56,73,89,.13);
  --brass:#2F5F8C;--brass-hi:#88BDF2;--brass-soft:rgba(189,221,252,.45);--on-brass:#fff;--patina:#6A89A7;--you:#E9734D;
  --shadow:0 14px 36px rgba(56,73,89,.16);--serif:"Geist",system-ui,sans-serif;--sans:"Geist",system-ui,sans-serif}
body{font-family:var(--sans)}
${hairline}
.card h3,.card.area h3,h2.band b,.hero h1,h1,.head h1{font-weight:600!important;letter-spacing:-.035em}
.card h3{font-size:20px}
.card.area h3{font-size:31px}
.timeline .yr,.tl-card b{font-weight:600;letter-spacing:-.02em}
#areaWrap{background:#BDDDFC;border-radius:0 0 30px 30px;padding-bottom:8px;margin-bottom:4px}
#areaWrap h2{color:#384959}
#areaWrap .card.area{background:transparent;border-color:rgba(56,73,89,.14)}
#areaWrap .actions button,#areaWrap .actions a{color:#384959}
.num,.pin{border-radius:8px}
.wiki{background:#384959;color:#fff}
.osm{background:#fff;color:#384959;box-shadow:inset 0 0 0 2px #6A89A7}
.wd{background:#6A89A7;color:#fff;box-shadow:none}
.ai{background:#E9734D;color:#fff;box-shadow:none}
.pin,.pin.osm,.pin.wd,.pin.ai{box-shadow:0 0 0 2.5px #fff,0 3px 8px rgba(27,39,51,.28)}
.pin.osm{box-shadow:inset 0 0 0 2px #6A89A7,0 0 0 2.5px #fff,0 3px 8px rgba(27,39,51,.28)}
.card .meta{color:#2F5F8C}
.card .src.gtag{color:#D25F3A}
.dock{background:#384959;border:0;box-shadow:0 16px 40px rgba(27,39,51,.3)}
.dock button{color:#BDDDFC}
.dock button.primary{background:#E9734D;color:#fff}
.dock button.on{background:rgba(189,221,252,.14);color:#fff}
.legend button{background:#fff;border-color:transparent;box-shadow:0 1px 2px rgba(27,39,51,.08)}
#map .leaflet-tile-pane{filter:grayscale(1) sepia(.25) hue-rotate(175deg) saturate(1.9) brightness(1.04) contrast(.86)}
.head{background:#BDDDFC;padding-bottom:22px;border-radius:0 0 28px 28px}
.when{color:#384959}
.links a,.links button{background:rgba(255,255,255,.65);border:0}
.tl{background:#E4EFFA}
.tl-dot{background:#2F5F8C}
.tl-card .more{background:#E9734D}
.see{background:#E4EFFA}
`};

const F = { name: 'F · Storm', fonts: FONTS_D, css: `
:root{--ground:#121A22;--surface:#1A242E;--raise:#202C38;--ink:#E8F1FA;--muted:#93A5B6;--rule:rgba(189,221,252,.10);
  --brass:#88BDF2;--brass-hi:#BDDDFC;--brass-soft:rgba(136,189,242,.10);--on-brass:#0F1820;--patina:#6A89A7;--you:#BDDDFC;
  --shadow:0 16px 40px rgba(0,0,0,.5);--serif:"Newsreader",Georgia,serif;--sans:"Inter",system-ui,sans-serif}
html,body{background:#121A22;color:#E8F1FA}
body{font-family:var(--sans)}
${hairline}
.card h3,.card.area h3,h2.band b,.hero h1,h1,.timeline .yr,.tl-card b{font-variation-settings:"opsz" 48}
.card .meta,.timeline .yr,.tl-card b,.ev-date{color:#F2B06B}
.card.inview::before{background:#F2B06B}
.wiki{background:#88BDF2;color:#0F1820}
.osm{background:#384959;color:#E8F1FA;box-shadow:inset 0 0 0 1.5px #6A89A7}
.wd{background:#6A89A7;color:#0F1820;box-shadow:none}
.ai{background:#121A22;color:#F2B06B;box-shadow:inset 0 0 0 2px #F2B06B}
.pin,.pin.osm,.pin.wd{box-shadow:0 0 0 2.5px #121A22,0 4px 10px rgba(0,0,0,.5)}
.dock{background:rgba(32,44,56,.86);backdrop-filter:blur(14px);border:1px solid rgba(189,221,252,.08)}
.dock button.primary{background:#88BDF2;color:#0F1820}
.dock button.on{background:rgba(136,189,242,.14);color:#BDDDFC}
#map .leaflet-tile-pane{filter:invert(1) grayscale(1) sepia(.3) hue-rotate(170deg) saturate(1.6) brightness(.72) contrast(1.08)}
#map{background:#1A242E}
.links a,.links button{background:transparent;border-color:rgba(189,221,252,.16);color:#E8F1FA}
.tl{background:#1A242E}
.tl-card{border:0;background:#202C38}
.tl-card .more{background:#F2B06B;color:#121A22}
.home{background:rgba(18,26,34,.75);color:#E8F1FA}
.see{background:rgba(136,189,242,.08)}
`};
module.exports = {A, B, C, D, E, F};
