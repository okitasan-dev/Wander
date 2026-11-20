# Wander: notes for Claude

Wander shows the history and nature around your GPS position, as you walk. It's a mobile-first **static web app on GitHub Pages**: https://okitasan-dev.github.io/Wander/ (repo `okitasan-dev/Wander`). It has no build step, no server and no npm dependencies. Every data source is called straight from the browser, so it must allow cross-origin requests (CORS).

## Working rules (from the owner)

- **Push straight to main when done.** Work on the session branch, then push it to main: `git push origin <branch>:main`. If the push is blocked, ask the owner to say "push".
- **Bump the version on every change.** Use major.minor.patch for big / medium / small changes. The version lives in four places, all of which must match:
  - `common.js`: `const WANDER_VERSION = 'x.y.z'` (shown in the footer)
  - `index.html`: `<script src="common.js?v=x.y.z">`
  - `place.html`: `<script src="common.js?v=x.y.z">`
  - `sw.js`: `const APP = 'wander-app-vx.y.z'` (a new cache name makes phones fetch the update)
  
  Quick way: `sed -i 's/OLD/NEW/' index.html place.html common.js sw.js`.
- **Credit every new data source** in the footer in `index.html`. Nature-only credits go in the `.nat-only` span.
- **Use as many quality sources as possible**, as long as they don't hurt speed. Merge sources rather than replacing them: the same place or species from two sources becomes one entry.
- **Write for the owner in plain language,** and test before pushing (see Testing).

## Secrets

**Never commit a key** (eBird or any other). Keys live only in the app's Settings on the owner's phone (`localStorage` `wander.ebirdKey`). The repo is public. The eBird test reads `WANDER_EBIRD_KEY` from the environment and skips itself without it.

## Files

| File | What it does |
|---|---|
| `index.html` | The whole main app: CSS, HTML, and one big inline script. It covers the map (Leaflet 1.9.4 from cdnjs), list, dock, sheets (Settings, AI guide, Places), Look mode, both modes, all data loaders and the AI prompts. |
| `place.html` | The detail page for a Wikidata item (`?id=Q…&lang=…`): hero, summary, facts, interactive timeline, gallery, and the AI guide's entry. It follows the mode's colours via the `wander.mode` key. |
| `common.js` | Shared by both pages. It holds helpers (`fetchJSON`, `fmtDist`, `cap`, `esc`, `yearOf` including deep-time dates, `byDate`), Wikipedia/Wikidata helpers, translation, Wikipedia term links, and **AI guide storage**: `normalizeGuide`, `addGuide`, `mergeEntry`, `samePlace`, `loadGuides`. |
| `sw.js` | The service worker. App files are network-first. Data APIs are network-first with a 6 s fallback to cache. Tiles, photos, fonts and libraries are cache-first. New data hosts must be added to its host lists. |
| `data/us-thermal-springs.json` | NOAA's US Thermal Springs List: 1,661 springs, compacted from PANGAEA (doi:10.1594/PANGAEA.981233, CC BY 4.0). Loaded only for US hot springs. |
| `design/mockup-themes.js` | CSS for the theme mockups A–F. The app doesn't use it yet (see Open threads). |
| `manifest.webmanifest`, `icons/` | The home-screen app definition and its icons. |
| `tests/` | Playwright tests (see Testing). |

## Modes

The dock's right-hand switch toggles **History** (columns icon) and **Nature** (leaf icon). The choice is stored as `wander.mode`, and the page gets `:root.nature`, which applies the Lush-forest colours.

- **Everything a mode changes is in `MODES` in `index.html`:** hero text, area heading, legend labels, source names, Settings labels, status text and theme colours.
- **What's shared:** GPS, map and layers, radius, Look, Places library and guide storage.
- **Dropped pin (both modes):** a long press on the map (Leaflet's `contextmenu`, which it also makes from a long press on iPhone; a right-click on a computer) drops a pin with a **Look around here** button (`dropPin`). The button searches that spot like the Go box (`setManual`, recorded in Places as Searched); closing the popup removes the pin. It asks first because a stray long press would otherwise throw away the current results.
- **Map filter (both modes):** pins, list numbers and the chips under the map are coloured by **category**, meaning what a place is, not which source found it (`CATS`, `catOf`, `pinClass` in `index.html`). History: Buildings, Religious sites, Monuments & plaques, Indigenous & ancient, Events & stories, Art & quirky, Museums, Folklore, Other. Nature: Water, Peaks & landforms, Rocks & minerals, Trees & plants, Wildlife, Parks & reserves, Viewpoints, Camping & trails, Other. Two buttons under the map, **Types** and **Sources**, each open a small menu of checkboxes (one menu open at a time), with **Show all** / **Hide all** at the top. Types lists only categories with places in range (`wander.hiddenCat`); Sources lists the sources (`wander.hiddenSrc`). Each button shows a dot while something in its menu with places in range is off. The menu fits itself above the dock and scrolls inside if needed. Hot springs and Fishing are their own entries in the Types menu, under an "Excursions" heading (still `wander.hiddenSrc` keys `spring`/`fish`); Types' Show all / Hide all covers them, their counts follow the Wild/Developed filter so they match the list, and a switched-off one is named in the "places hidden" note. Pins stay numbered to match the cards; AI-guide-only places get a white inner ring.
- **`refresh()` branches on `state.mode`:**
  - History: Wikipedia geosearch, Wikidata heritage and archaeology, the national registers, OpenStreetMap historic features, Wikivoyage sights, and Commons photos.
  - Nature: a Wikidata natural-features query, OpenStreetMap natural features, Wikivoyage outdoor listings, `loadNature()` for the "About this land" card, and `loadFar()` for Excursions.
- **Switching mode** clears items and pins and searches again. The session (`wander.session`) is per mode.
- **Adding a mode:** add a `MODES` entry, a branch in `refresh()`, an area card, a prompt, and CSS tokens under `:root.<mode>`.

### History mode

- **Cards** come from Wikipedia articles near you, enriched by Wikidata facts.
- **Registers:** national heritage registers merge into matching cards, adding the designation, a **Listing** link and the register's text. Anything unmatched becomes its own card.
- **Area cards** (`loadAreaCards`, in the background so the list isn't held up): the closest area with a Wikipedia article first, then wider ones, e.g. Crest Park, Lake Arrowhead, San Bernardino County. With more than one, they sit under "Right here" and "Wider area" (the widest), with a smaller heading. Each card has the area's article, its facts (including "Name in Māori" etc.), "The name" (the article's etymology section), "Earliest peoples" (its Indigenous/prehistory section, or the history section's opening paragraph when that is about the first peoples; `earlyPeoples`/`nameOrigin` in `common.js`), and "History in brief", which also draws on the earliest-peoples section and skips sentences already shown above it.
- **AI prompt:** includes Indigenous and prehistoric history, folklore and sensitive-site rules.

### Nature mode

- **"About this land" card** (`natureAreaHTML`), section by section:
  - Bedrock and surface deposits
  - Ground: elevation and soil
  - Water
  - Climate
  - Shaping forces: earthquakes and faults
  - In season, with group chips
  - Birds lately (eBird)
  - Plants: native, introduced and street trees, with plant-group chips
  - Life, with group chips
  - Photos
- **AI content in the card** sits in boxes labelled "AI guide · for this area".
- **Show less:** open area cards (this one and History's) have a Show less right under the heading as well as at the bottom; closing from the bottom scrolls back up to the card.
- **Excursions** (hot springs and fishing) use their own radius (Settings → Excursion range: 10/25/50/100 mi), their own chips and pins (♨ and fish), and a Wild/Developed filter for springs.
- **Look mode** adds skyline peaks (`skylineAhead`) in the direction the phone points.

## Data sources

**General quirks:**
- Wikimedia (Wikipedia, Commons, Wikivoyage, the www.wikidata.org API) often answers **429 from the sandbox's shared IP**. The phone is fine.
- `query.wikidata.org` SPARQL works from the sandbox.
- Nominatim allows 1 request/s (throttled in `nominatim()`).
- ArcGIS **MapServer** queries reject `resultRecordCount` ("Pagination is not supported"); **FeatureServer** queries accept it.

### Used by both modes
| Source | Use and quirks |
|---|---|
| Nominatim (OSM) | Reverse geocoding: neighbourhood (or hamlet), city, `cc`, and `state.sub` (`ISO3166-2-lvl4`, e.g. `GB-SCT`, which picks the UK register). Area cards use zoom 14, 12 (skipped when zoom 14 is already a town or city) and 10, closest first. |
| Wikipedia | Geosearch and extracts in the user's language and the local one |
| Wikivoyage | Reads the 2 nearest destination articles per language (up to 3 languages) and parses `{{see}}`/`{{do}}`/`{{listing}}`/`{{vCard}}`/`{{voir}}`… templates with coordinates. History mode takes sights; Nature mode takes outdoor keywords. A match adds "Wikivoyage: …" to that card. |
| Wikimedia Commons | Geosearch for files (ns 6), photos from before 1950 first; used as a fallback thumbnail for a matching card. Only standard thumbnail widths (250/330/500/960/1280) work; others give 400. |
| OSM tiles, Esri imagery, OpenTopoMap | Street, Satellite and Terrain layers |
| Macrostrat tiles plus national geology | Geology layer: BGS (GB), GSJ (JP, max zoom 13), Geoscience Australia, BRGM (FR, **unverified**, it blocks the sandbox) |

### History mode
| Source | Use and quirks |
|---|---|
| Wikidata SPARQL | Three queries: heritage (`P1435`, limit 150), **archaeological sites in their own query** (limit 80), so that listed buildings can't crowd them out, and **Indigenous and ancient site types** (limit 60: petroglyph, rock art, geoglyph, midden, earthworks, burial mound, kofun, pueblo, village site, marae, pā, heiau, ahu; QIDs verified; urupā and other burial grounds deliberately left out). Strong in New Zealand, some in Canada, thin in California. Names: `P1705` (native label) and `P1448` (official name) in an Indigenous or older language (`ORIG_LANGS`) become "Name in …" facts for areas and places. Ordinary labels in those languages are **not** used: most are translations of the modern name (a Navajo label for New York). |
| OpenStreetMap Overpass | Plaques, memorials, ruins. **Blocked from the sandbox** (connections cut), so tests simulate it. |
| Historic England (England) | ArcGIS `services-eu1…/NHLE_v02_VIEW`. Covers Grade I and II\* (**Grade II excluded**: it's ~90% of entries, down to lamp posts), scheduled monuments, parks and gardens, battlefields, wrecks and World Heritage Sites. Names come in CAPS and are tidied by `heTitle`. |
| Historic Environment Scotland | `inspire.hes.scot`: Category A listed, Properties in Care, scheduled monuments, gardens, battlefields, World Heritage Sites, plus **Canmore** archaeology (`ARCHAEOLOG='Y'`, with "No class/event/findspot" dropped). The `services-eu1…/HES_Scheduled_Monuments` copy belongs to a council, so don't use it. |
| Northern Ireland HED | `services2.arcgis.com/BdBkthNLO9mzGAMO/…`: monuments, Grade A/B+ buildings, battle sites (with sides and outcome), parks |
| Ireland | NIAH (`NIAHBuildingsOpenData`, ratings National/International only, with appraisal text) and the SMR (`SMROpenData`, excluding "Redundant"/"Non-antiquity") |

### Nature mode
| Source | Use and quirks |
|---|---|
| Wikidata SPARQL | Natural features: `P31/P279?` in `NATURE_CLASSES` (QIDs verified), with `NOT_NATURE` filtering out tennis courts, zoos and the like |
| OSM Overpass | Springs, peaks, trees (named, notable or heritage only), viewpoints, quarries, survey markers; street-tree counts; skyline peaks; Excursions |
| Macrostrat | Bedrock at the point plus its source map (`defs/sources`, often a USGS report). The more detailed of Macrostrat and the national survey leads (`geoPair`). |
| BGS / GSJ / Geoscience Australia | Point lookups. BGS returns GeoJSON with bedrock and superficial deposits; Geoscience Australia only does Esri XML (GeoJSON is listed but rejected). |
| Open-Meteo | Elevation, and 10 years of daily ERA5 weather turned into a Köppen climate type in the app. Rate-limited from the sandbox. |
| ISRIC SoilGrids | Soil class; slow (~12 s), so it fills in later |
| USGS | Earthquakes (FDSN, worldwide; needs `starttime`, which defaults to 30 days) and the watershed (WBD, US only) |
| iNaturalist | Species, groups, native/introduced plants (via the most local standard place), In season, and names/photos for other sources' species. **Queued at 3 requests at a time, 250 ms apart** (`inatJSON`). |
| GBIF | Merged into Life, groups, In season and thin Plants. One request per list using `facet=scientificName`; last 25 years; group filtering via `GBIF_TAXA` keys. |
| eBird | Only with the owner's key: recent sightings, rare birds and hotspots (`X-eBirdApiToken` header; CORS works) |
| NOAA (bundled), OSM, Wikidata, Wikipedia | Hot springs. Wikidata is strong for Japanese onsen and thin for US wild springs. **Temperature:** NOAA, OSM `temperature`, Wikidata `P2076` (only ~11 of 846 springs have it), else the first °F/°C in the spring's Wikipedia intro. **Closed / Historic site tags:** Wikidata `P576`/`P3999`/`P5817` (almost never filled in) and OSM `disused`/`abandoned`/`access=no`/`historic`; mostly from the Wikipedia intro (`springFromText`): a sentence saying it closed, was demolished etc. marks it Closed (not if it says it reopened) and the card shows that sentence unless the summary already does; "historic" or "was a…" in the first sentence marks a Historic site. The intro also becomes the card's summary. |
| OSM and iNaturalist | Fishing spots, and fish recorded in the area |

### Checked and rejected
- **France (Mérimée):** the culture data portal moved to a platform that can't search by distance. It's covered by Wikidata `P1435` (~45k items with Mérimée IDs).
- **Japan cultural properties:** no open API; covered by Wikidata.
- **Kew Plants of the World Online:** returns 403 to apps, so native status comes from iNaturalist plus GBIF.
- **Native Land Digital:** needs an API key and licence.
- **PANGAEA:** used once, to build the NOAA file; not called at runtime.

## Design decisions

- **Register caps:** in dense centres (Westminster, Edinburgh Old Town), only the **nearest 40 new cards per register layer** are added, and register-made cards hold at most 5 facts. Matches with existing cards are always merged, and a card keeps one grade (the first, highest-ranked).
- **How categories are decided:** rules run in priority order (e.g. Indigenous & ancient before Religious before Buildings), first on what sources say a place is (Wikidata types, register entries, OSM tags, the AI guide's `kind`/`folklore`), then on its name and first lines. Protection labels ("Scheduled monument", "Grade II listed") are set aside first, because they say how a place is listed, not what it is; a listed place with nothing else to go on counts as a Building. eBird hotspots are Wildlife. Type labels are matched in English, so other reader languages lean on OSM tags and names more. The result is cached on the item until its facts change.
- **Dedup everywhere:** name overlap (`nameOverlap(...).cont ≥ .5`) plus distance (150 m for points, 500 m for areas). The same place from two registers becomes one card.
- **AI guides** are stored in `wander.guides` (max 20) and normalised and sanitised on import.
  - History guides carry `indigenousName` for the area and each place (the Indigenous or earliest known name, its people or language and meaning), shown as "Original name".
  - Each guide is tagged `mode` (history/nature) and optionally `topic` (springs/fishing).
  - Guides merge only with the same mode and topic, within 800 m (8 km for topic guides). Places within a guide merge by `samePlace`.
  - Nature guides carry `ground` (bedrock, surface, soil, water, climate, plants, trees, hazards) and `species`.
  - Topic guides add temperature, access, land, season, species, rules and safety per place.
  - Importing a guide for the other mode switches to it.
  - The prompts ask for a single JSON block, and cut-off replies are salvaged.
- **Wikidata names link to Wikipedia:** names in "Did you know" (died, buried, lived here, set or filmed here, events, oldest/tallest) and in the fact grid (Architect, Founded by, Created by, Named after, Dedicated to, Commemorates, Commissioned by, Part of, Owned by) are drawn as `<span class="wdn" data-q>` (`wdName`). After each redraw, `applyWikiLinks` calls `linkWdNames`, which asks Wikidata for those items' articles in one small query (reader's language, else English) and turns them into article-panel links. The fact queries themselves are unchanged: putting the article lookup inside them made area queries 2–4× slower. Answers are remembered for the visit; a failed lookup leaves names plain.
- **AI vs service data:** service data leads, and the AI fills gaps or adds detail, always labelled. When two maps disagree, both are shown.
- **iNaturalist pacing:** Nature mode makes about 12 iNaturalist calls per spot, and parallel bursts got 429s, hence the queue. Taxon lookups for GBIF and eBird species are cached in `wander.taxa`.
- **Season test:** a species is "seasonal" if this month and its neighbours hold at least 2.5× the share they hold for all sightings there. This corrects for busy months like spring bioblitzes.
- **eBird key on the device:** the repo and site are public, so a committed key would be visible to anyone.
- **Photos rows:** tiles show 2 rows that scroll sideways (`speciesRow`); 6 or fewer show as a plain grid.
- **Group chips:** counts come from iNaturalist and show "+" when GBIF adds more. Per-group GBIF counts would cost 10 more requests.
- **Persistence:** these settings are saved on the device: mode, radius, sight, layer, Excursion range, spring filter, group picks, guide topic/radius/depth (per mode), hidden sources and visit recording.

## Open threads and ideas

- **Theme picker** (deferred by the owner): Classic (current), plus the mockups in `design/mockup-themes.js`:
  - A Terracotta, B Golden hour, C Dusk (dark A), from the Tuscan-sunset palette: #E35336, #FFD3AC, #9988A1, #8A2B0E.
  - D Slate, E Overcast, F Storm (dark D), from the Stormy-morning palette: #6A89A7, #BDDDFC, #88BDF2, #384959.
  - Planned as a Settings section with Appearance Auto/Light/Dark. B and E have no dark version yet.
- **Wales (Cadw)** register: not added; check whether DataMapWales WFS allows CORS.
- **Indigenous history (History mode):** the owner wants Indigenous history, prehistory, prominent Indigenous cultural sites and original place names, not territory maps (Native Land Digital isn't needed). Done in 3.12.0: area-card sections, Wikidata site types and names, guide `indigenousName`. Possible later: official dual names from New Zealand's Gazetteer (LINZ, needs a key) and Canada's CGNDB (`geogratis.gc.ca`, not on the sandbox allowlist, CORS unchecked); Australia has no single open source.
- **Unverified live** (blocked from the sandbox): OSM Overpass features (street trees, OSM peaks and springs, fishing spots), the BRGM geology layer, and Wikivoyage/Commons (tested with simulated responses only).
- **Only testable on a phone:** haptics, compass/Look, Add to Home Screen, Google Maps links, and a real long press on the map (tests use a right-click, which fires the same event).
- **New sources the owner chose (next):** Europeana, DPLA, Trove, NPS, Flickr, Mapillary, OpenTripMap, MapTiler, Mindat and Recreation.gov, each with a free key stored on the device like eBird. Check each one's CORS first and add its host to the sandbox allowlist for live tests. **Photo and archive sources (Flickr, Mapillary, Europeana, DPLA, Trove) enrich existing cards and pins with photos, not new pins.** NPS, OpenTripMap, Mindat and Recreation.gov add places, which slot into the categories.
- **Possible later:** more registers (Netherlands Rijksmonumenten, Wales), and France via the new data.gouv API if it gains geo search.

## Testing

Playwright and Chromium are preinstalled (`require('playwright')` works anywhere). Run a test from the repo root:

```bash
node tests/nature.test.js
```

Each test prints its findings and ends with `errors []` (page errors). Screenshots go to `tests/out/` (gitignored).

- **Local server:** tests that need real network answers start `tests/serve.js` (`http://localhost:<port>`). Several services (Nominatim, Open-Meteo) refuse pages opened from `file://`, and service workers need http. Tests run with `serviceWorkers: 'block'`, because requests made by a service worker bypass Playwright's routes.
- **Simulated responses:** tests use `page.route` to let real hosts through and fulfil the rest with fixtures in the documented formats. Fixtures live in `tests/fixtures/`: stand-in photos, map tiles, and a sample Burbank guide. Wikimedia (429 from the sandbox) and Overpass (blocked) are always simulated.
- **Live tests:** `geology-live`, `in-season`, `soil-climate-quakes`, `gbif`, `heritage-registers`, `skyline`, `excursions` and `ebird` can time out when a service rate-limits after many runs. Re-run later before suspecting the code.
- **Network:** the cloud environment's allowlist already includes every data service above (Wikidata, Wikipedia, Commons, Macrostrat, GSJ, BGS, BRGM, Geoscience Australia, iNaturalist, GBIF, eBird, Open-Meteo and its archive, USGS, ISRIC, the HES/HED/NIAH/HE ArcGIS hosts, Wikivoyage en/ja, PANGAEA, Overpass, Kew, the French portal). The live tests need nothing extra.

| Test | Covers |
|---|---|
| `nature` | Mode switch, Nature sources (simulated), land card, prompt, guide import, reload |
| `places-library`, `go-box`, `gps-toggle`, `dock`, `sheets`, `depth-help` | Places library, Go box parsing and geocoding, GPS pause, dock, sheets, ? help |
| `area-name` | Nature card heading follows the place: away spot, then back to GPS, then a mode swap (jumping mid-search) |
| `show-less` | Open Nature and History area cards: Show less at the top and the bottom, and closing from the bottom scrolls back to the card |
| `wikidata-links` | "Where … died" and fact-grid names become article links after one lookup (simulated Wikidata), names without articles stay plain, redraws reuse the answers, tapping opens the panel |
| `drop-pin` | Long press (right-click in the test) drops a pin; closing removes it; Look around here searches there, moves the map and records it in Places |
| `area-levels` | History area cards closest first (hamlet, town, county near Lake Arrowhead; simulated Nominatim), the two sections, a city with one card |
| `map-layers`, `source-chips` | Street/Satellite/Terrain layers (simulated tiles), chip counts |
| `history-prompt`, `heritage-registers`, `wikivoyage-commons-he` | History prompt and archaeology, live registers (Edinburgh, Belfast, Dublin, Newgrange, London), Wikivoyage/Commons merge |
| `excursion-chips` | Hot springs chip count matches the Excursions list under each Wild/Developed filter; a switched-off section is named in the hidden note; Hot springs inside the Types menu; temperature and Closed/Historic flags (live NOAA + Wikidata, stand-in Wikipedia intros, Burbank) |
| `categories` | Category rules on 24 sample places (both modes), pin colours, the Types and Sources menus, Show all / Hide all |
| `indigenous-history` | "The name" and "Earliest peoples" (simulated Wikipedia, incl. Burbank/London/Kyoto samples), "Name in Māori" and site types (live Wikidata: Auckland marae, Stanley Park village site), guide `indigenousName` |
| `geology-live`, `soil-climate-quakes`, `in-season`, `species-groups`, `species-rows`, `gbif`, `ebird` | Live Nature data (`ONLY="Kyoto,London"` limits the places in the first three) |
| `excursions`, `skyline`, `place-timeline`, `deep-time-dates` | Hot springs and fishing, skyline peaks, place-page guide timeline, date parsing |
