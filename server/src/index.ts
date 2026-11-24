/**
 * Wander tour-guide backend (Cloudflare Worker).
 *
 *   GET  /         a small test page: open it on your phone and tap the button
 *   GET  /health   says whether the backend is set up correctly
 *   POST /tour     { lat, lon, lang?, place?, candidates? } -> streamed story (Server-Sent Events)
 *
 * The Anthropic API key lives only here, as a Cloudflare secret named ANTHROPIC_API_KEY.
 */
import Anthropic from "@anthropic-ai/sdk";
import { TEST_PAGE } from "./test-page";

export interface Env {
  ANTHROPIC_API_KEY?: string;
  TOURS: KVNamespace;
  PER_IP?: RateLimit;
  DAILY_LIMIT?: string;
  ALLOWED_ORIGINS?: string;
}

interface Candidate {
  title: string;
  dist?: number; // metres
  dir?: string; // compass direction, e.g. "NE"
  extract?: string;
}

interface TourRequest {
  lat: number;
  lon: number;
  lang: string;
  place?: string;
  candidates: Candidate[];
}

const MODEL = "claude-opus-5-5";
const CACHE_DAYS = 30;

const SYSTEM = `You are Wander, a warm, knowledgeable walking-tour guide.
The listener is standing at the coordinates given. You are given nearby landmarks found on Wikipedia as a starting point.

Research before you write: use web search to read several independent sources about this spot and the landmarks around it, such as heritage registers, local historical societies, newspapers, museums, university pages, travel writing and Wikipedia. Look for the specific, surprising and human details that a generic summary would miss.

Then write a spoken narration of about 200-250 words:
- Open by telling them where they are, then cover the most interesting things nearby, closest first.
- Give directions with compass points and distances ("about 100 metres to the north-east").
- Prefer concrete stories, dates, people and oddities over generic description.
- Only state facts your sources support. If something is folklore or disputed, say so ("local legend says").
- It will be read aloud by text-to-speech, so write plain flowing sentences: no markdown, headings, lists, URLs or emoji.
- Output only the narration itself, with no preamble about your research.`;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(TEST_PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json(
        {
          ok: Boolean(env.ANTHROPIC_API_KEY),
          apiKey: env.ANTHROPIC_API_KEY ? "set" : "MISSING - add the ANTHROPIC_API_KEY secret",
          cache: env.TOURS ? "ok" : "MISSING",
          model: MODEL,
        },
        200,
        cors,
      );
    }

    if (request.method === "POST" && url.pathname === "/tour") {
      return handleTour(request, env, ctx, cors);
    }

    return json({ error: "Not found" }, 404, cors);
  },
};

async function handleTour(request: Request, env: Env, ctx: ExecutionContext, cors: Headers): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "The server has no ANTHROPIC_API_KEY secret yet." }, 500, cors);
  }

  let tour: TourRequest;
  try {
    tour = parseTourRequest(await request.json());
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Invalid request" }, 400, cors);
  }

  // Roughly a 100 m square; everyone standing in it shares one cached story.
  const cacheKey = `tour:v1:${tour.lat.toFixed(3)}:${tour.lon.toFixed(3)}:${tour.lang}`;
  const cached = await env.TOURS.get(cacheKey);
  if (cached) {
    const { story, sources } = JSON.parse(cached);
    return sse(cors, async (send) => {
      send({ type: "text", text: story });
      send({ type: "sources", sources });
      send({ type: "done", cached: true });
    });
  }

  // Spending guards: only uncached requests cost money, so only they are limited.
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (env.PER_IP) {
    const { success } = await env.PER_IP.limit({ key: ip });
    if (!success) return json({ error: "Too many requests - wait a minute and try again." }, 429, cors);
  }
  const dayKey = `count:${new Date().toISOString().slice(0, 10)}`;
  const usedToday = Number((await env.TOURS.get(dayKey)) ?? 0);
  if (usedToday >= Number(env.DAILY_LIMIT ?? 20)) {
    return json({ error: "Daily limit reached - try again tomorrow." }, 429, cors);
  }
  ctx.waitUntil(env.TOURS.put(dayKey, String(usedToday + 1), { expirationTtl: 60 * 60 * 48 }));

  if (tour.candidates.length === 0) {
    tour.candidates = await wikipediaNearby(tour.lat, tour.lon, tour.lang).catch(() => []);
  }

  const cf = request.cf as IncomingRequestCfProperties | undefined;
  return sse(cors, async (send) => {
    const { story, sources } = await research(env.ANTHROPIC_API_KEY!, tour, cf, (text) =>
      send({ type: "text", text }),
    );
    send({ type: "sources", sources });
    send({ type: "done", cached: false });
    if (story.trim()) {
      await env.TOURS.put(cacheKey, JSON.stringify({ story, sources }), {
        expirationTtl: 60 * 60 * 24 * CACHE_DAYS,
      });
    }
  }, ctx);
}

/** Ask Claude to research the spot with web search and stream the narration back. */
async function research(
  apiKey: string,
  tour: TourRequest,
  cf: IncomingRequestCfProperties | undefined,
  onText: (text: string) => void,
): Promise<{ story: string; sources: { url: string; title: string }[] }> {
  const client = new Anthropic({ apiKey });

  const landmarks = tour.candidates.length
    ? tour.candidates
        .map((c) => `- ${c.title}${c.dist != null ? ` | ${c.dist} m ${c.dir ?? ""}` : ""}${c.extract ? ` | ${c.extract}` : ""}`)
        .join("\n")
    : "(none found - rely on web search)";

  const prompt = `Location: ${tour.lat}, ${tour.lon}${tour.place ? ` (${tour.place})` : ""}
Nearby landmarks (name | distance and direction from the listener | summary):
${landmarks}

Write the narration in this language: ${tour.lang}.`;

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];
  let story = "";
  const sources = new Map<string, string>();

  // A long research turn can pause ("pause_turn"); sending it back lets it continue.
  for (let attempt = 0; attempt < 4; attempt++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "medium" },
      // If a safety filter wrongly declines the request, retry it on a fallback model automatically.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: 8,
          user_location: {
            type: "approximate",
            city: cf?.city ?? null,
            region: cf?.region ?? null,
            country: cf?.country ?? null,
            timezone: cf?.timezone ?? null,
          },
        },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: 4 },
      ],
      messages,
    });

    stream.on("text", (delta) => {
      story += delta;
      onText(delta);
    });
    const message = await stream.finalMessage();

    for (const block of message.content) {
      if (block.type !== "text") continue;
      for (const c of block.citations ?? []) {
        if (c.type === "web_search_result_location" && !sources.has(c.url)) sources.set(c.url, c.title ?? c.url);
      }
    }

    if (message.stop_reason === "refusal") throw new Error("The AI declined to answer for this location.");
    if (message.stop_reason !== "pause_turn") break;
    messages.splice(1, messages.length - 1, { role: "assistant", content: message.content });
  }

  return { story, sources: [...sources].map(([url, title]) => ({ url, title })) };
}

/** Free fallback list of nearby places, used when the app doesn't send its own. */
async function wikipediaNearby(lat: number, lon: number, lang: string): Promise<Candidate[]> {
  const params = new URLSearchParams({
    action: "query", format: "json", formatversion: "2",
    generator: "geosearch", ggscoord: `${lat}|${lon}`, ggsradius: "1000", ggslimit: "15",
    prop: "extracts|coordinates", exintro: "1", explaintext: "1", exsentences: "3", exlimit: "max",
  });
  const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`, {
    headers: { "user-agent": "WanderGuide/0.1 (tour-guide backend)" },
  });
  if (!res.ok) return [];
  const data: any = await res.json();
  const pages: any[] = data?.query?.pages ?? [];
  return pages
    .filter((p) => p.coordinates?.[0])
    .map((p) => {
      const to = { lat: p.coordinates[0].lat, lon: p.coordinates[0].lon };
      return {
        title: p.title,
        dist: Math.round(distance({ lat, lon }, to) / 10) * 10,
        dir: compass(bearing({ lat, lon }, to)),
        extract: String(p.extract ?? "").slice(0, 400),
      };
    })
    .sort((a, b) => a.dist - b.dist);
}

/* ---------- helpers ---------- */

function parseTourRequest(body: any): TourRequest {
  const lat = Number(body?.lat), lon = Number(body?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new Error("Send numeric lat and lon.");
  }
  const lang = typeof body?.lang === "string" && /^[a-z]{2,3}$/.test(body.lang) ? body.lang : "en";
  const place = typeof body?.place === "string" ? body.place.slice(0, 200) : undefined;
  const candidates: Candidate[] = Array.isArray(body?.candidates)
    ? body.candidates.slice(0, 15).map((c: any) => ({
        title: String(c?.title ?? "").slice(0, 150),
        dist: Number.isFinite(Number(c?.dist)) ? Math.round(Number(c.dist)) : undefined,
        dir: typeof c?.dir === "string" ? c.dir.slice(0, 10) : undefined,
        extract: typeof c?.extract === "string" ? c.extract.slice(0, 400) : undefined,
      })).filter((c: Candidate) => c.title)
    : [];
  return { lat, lon, lang, place, candidates };
}

type Send = (event: Record<string, unknown>) => void;

/** Stream events to the phone as Server-Sent Events, turning any failure into a readable message. */
function sse(cors: Headers, run: (send: Send) => Promise<void>, ctx?: ExecutionContext): Response {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const send: Send = (event) => void writer.write(enc.encode(`data: ${JSON.stringify(event)}\n\n`)).catch(() => {});

  const work = run(send)
    .catch((err) => {
      console.error(err);
      send({ type: "error", message: friendlyError(err) });
    })
    .finally(() => writer.close().catch(() => {}));
  ctx?.waitUntil(work);

  const headers = new Headers(cors);
  headers.set("content-type", "text/event-stream; charset=utf-8");
  headers.set("cache-control", "no-cache");
  return new Response(readable, { headers });
}

function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The Anthropic API key is wrong or revoked.";
  if (err instanceof Anthropic.PermissionDeniedError) return "The Anthropic account can't use this model or feature.";
  if (err instanceof Anthropic.RateLimitError) return "Anthropic rate limit hit - try again shortly.";
  if (err instanceof Anthropic.BadRequestError && /credit|billing/i.test(err.message)) {
    return "Your Anthropic account is out of credit - add some in the Console.";
  }
  if (err instanceof Anthropic.APIError) return `Anthropic API error ${err.status ?? ""}: ${err.message}`;
  return err instanceof Error ? err.message : "Something went wrong.";
}

function corsHeaders(request: Request, env: Env): Headers {
  const allowed = (env.ALLOWED_ORIGINS ?? "*").split(",").map((s) => s.trim());
  const origin = request.headers.get("origin") ?? "";
  const h = new Headers({
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "origin",
  });
  if (allowed.includes("*")) h.set("access-control-allow-origin", "*");
  else if (allowed.includes(origin)) h.set("access-control-allow-origin", origin);
  return h;
}

function json(body: unknown, status: number, cors: Headers): Response {
  const headers = new Headers(cors);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

const toRad = (d: number) => (d * Math.PI) / 180;
function distance(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(x));
}
function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
function compass(deg: number) {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
}
