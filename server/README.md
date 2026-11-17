# Wander Guide backend

This folder is the small server that sits between the Wander app and Claude.

- The phone sends **"I'm standing at these coordinates"**.
- The server asks Claude to **search the web, read several sources, and write a short spoken story** about the spot.
- The story streams back to the phone word by word, along with a **list of sources**.
- Your **Anthropic API key stays here**, never inside the app where anyone could copy it.
- Finished stories are **cached for 30 days** per ~100 m square, so a spot is only paid for once.

It runs on **Cloudflare Workers**: free to start, nothing to install on your computer, and it deploys automatically from GitHub.

```
phone ──► https://wander-guide.<you>.workers.dev/tour ──► Claude (web search + writing)
      ◄── story + sources (streamed)                   ◄──
```

---

## Step 1: Get an Anthropic API key (about 10 minutes)

1. Go to **console.anthropic.com** and sign up or log in.
2. **Add credit:** open the Billing section and buy a small amount ($5–10 is plenty for testing).
3. **Set a spending limit:** in the Limits section, set a monthly limit you're comfortable with (e.g. $20). This is your safety net: Anthropic stops the requests once you hit it.
4. **Create a key:** open API Keys and click Create Key. Name it `wander-guide`.
5. Copy the key (it starts with `sk-ant-`) somewhere private for a few minutes. You'll paste it into Cloudflare in Step 3.
   - **Never** put this key in `index.html`, commit it to GitHub, or share it. If it leaks, delete it in the Console and make a new one.

## Step 2: Put the backend on Cloudflare (about 15 minutes)

1. Go to **dash.cloudflare.com** and create a free account.
2. In the left menu open **Workers & Pages** and click **Create**.
3. Choose the option to **import a Git repository**, and connect your GitHub account when asked.
   Give Cloudflare access to the `wander` repository.
4. Pick the `wander` repository and fill in the settings:

   | Setting | Value |
   |---|---|
   | Project / Worker name | `wander-guide` (must match the `name` in `wrangler.jsonc`) |
   | Root directory | `server` |
   | Build command | *(leave empty)* |
   | Deploy command | `npx wrangler deploy` |
   | Production branch | the branch that contains this `server` folder (usually `main`) |

5. Click **Deploy**. The first build takes a minute or two.
   Cloudflare also creates the cache storage for you automatically.
6. When it finishes, you get an address like
   `https://wander-guide.<your-name>.workers.dev`. Save it: that's your backend's URL.

From now on, **every time this folder changes on that GitHub branch, Cloudflare redeploys by itself.**

## Step 3: Give the server your API key (2 minutes)

1. In Cloudflare, open **Workers & Pages → wander-guide → Settings**.
2. Find **Variables and Secrets** and click **Add**.
3. Set Type to **Secret**, Name to `ANTHROPIC_API_KEY` (exactly like that), and paste your key as the value.
4. Save / Deploy.

Secrets are encrypted. They aren't shown again, even to you, and they don't end up in GitHub.

## Step 4: Try it

1. Open `https://wander-guide.<your-name>.workers.dev/health` in a browser.
   You should see `"ok":true` and `"apiKey":"set"`. If not, see Troubleshooting below.
2. Open `https://wander-guide.<your-name>.workers.dev/` **on your phone**.
3. Tap **Colosseum, Rome** (works from anywhere) or **Tell me about where I am** (asks for your location).
4. Wait 20–60 seconds the first time. The story appears and is read aloud, with sources underneath.
   Tap the same spot again: it's instant and free, served from the cache.

---

## Costs and safety limits

| What | Cost |
|---|---|
| Cloudflare Workers free plan | $0 (100,000 requests/day) |
| Each **new** spot researched | Roughly 10–40 US cents (web searches at $10 per 1,000 + model usage). Check the Anthropic Console's usage page after a few tries for real numbers. |
| A spot someone already asked about (cached) | $0 |

Built-in protections, all adjustable in `wrangler.jsonc`:

- `DAILY_LIMIT`: at most **20 new stories per day** in total. Raise it once you're comfortable.
- **3 new stories per minute** per person (the `ratelimits` section).
- Your **Anthropic spend limit** from Step 1, as a final cap.

The test page at `/` is public, so anyone who finds the URL could use up your daily limit. That's fine while testing. Before sharing the app widely, set `ALLOWED_ORIGINS` to your app's web address.

## Using your Namecheap domain (optional, do this later)

You can serve the backend at something nicer like `https://api.yourdomain.com`. To do that, Cloudflare needs to manage the domain's DNS:

1. In Cloudflare, click **Add a domain** and enter your domain (free plan). Cloudflare copies your existing DNS records.
2. **Check the copied records** against Namecheap's Advanced DNS page, especially email (MX) records and any website records, before switching.
3. In Namecheap: **Domain List → Manage → Nameservers → Custom DNS**, then enter the two nameservers Cloudflare shows you.
4. Once Cloudflare says the domain is active, open **wander-guide → Settings → Domains & Routes → Add → Custom domain** and enter `api.yourdomain.com`.

Tip: practise on a domain you aren't using for email or a live site. You keep paying Namecheap for the domain itself; only the DNS moves.

**Namecheap's shared hosting** (cPanel) is better suited to the *app* (the `index.html` page) than to this backend. Shared hosting tends to buffer streamed responses and has no built-in caching or rate limiting, so keep the backend on Cloudflare.

## Troubleshooting

| You see | Fix |
|---|---|
| `/health` shows `"apiKey":"MISSING…"` | Step 3 wasn't saved, or the name isn't exactly `ANTHROPIC_API_KEY`. |
| "The Anthropic API key is wrong or revoked." | Re-copy the key, or make a new one, and update the secret. |
| "Your Anthropic account is out of credit" | Add credit in the Anthropic Console. |
| "Daily limit reached" | Working as designed. Raise `DAILY_LIMIT` in `wrangler.jsonc` if you want more. |
| Build failed in Cloudflare | Open the build log. Check that the root directory is `server` and the Worker name is `wander-guide`. |
| Error mentioning **CPU time limit exceeded** | The free plan allows only a little processing per request. Switch to Workers Paid ($5/month) under Workers & Pages → Plans. |
| Anything else | **wander-guide → Logs** (or Observability) in Cloudflare shows the server's errors. |

## How the app talks to it (for wiring up `index.html` later)

`POST /tour` with JSON:

```json
{ "lat": 41.8902, "lon": 12.4922, "lang": "en",
  "place": "Rome, Italy",
  "candidates": [{ "title": "Arch of Constantine", "dist": 120, "dir": "W", "extract": "…" }] }
```

Only `lat` and `lon` are required. Without `candidates`, the server looks up nearby Wikipedia articles itself.
The response is a stream of `data: {...}` lines:
`{"type":"text","text":"…"}` (repeated), then `{"type":"sources","sources":[{url,title}]}`, then `{"type":"done","cached":false}`, or `{"type":"error","message":"…"}`.

## Files

- `src/index.ts`: the server. The `SYSTEM` text near the top is the guide's "personality and rules", so edit it to change the tone or length of stories.
- `src/test-page.ts`: the test page served at `/`.
- `wrangler.jsonc`: Cloudflare settings (name, cache, limits).
- `package.json`: the libraries used (Anthropic SDK, Cloudflare tooling).

### Running on your own computer (optional, for later)

Install Node.js 20+, then from this folder:

```bash
npm install
```

```bash
echo "ANTHROPIC_API_KEY=sk-ant-your-key" > .dev.vars
```

```bash
npm run dev
```

Then open http://localhost:8787. `.dev.vars` is git-ignored, so the key stays on your machine.
