# Counter Test Site

A deliberately boring website whose only job is to generate pageviews for
[IA-Counter](https://github.com/DaEpickid540/IA-Counter), a privacy-first
analytics tool.

It is static HTML on GitHub Pages reporting to a collector hosted elsewhere, so
it exercises the real path an actual installation takes: one script tag, a
cross-origin beacon, over HTTPS, from a CDN.

## What each page is for

| Page | Tests |
| --- | --- |
| `/` | A plain pageview |
| `/programs/` | A second path, so the Pages breakdown has rows |
| `/techolympics/` | UTM capture — the path stays clean, the campaign is recorded |
| `/about/` | Bounces and time-on-page |
| `/app/` | SPA routing via `pushState`, and INP from a blocked main thread |
| `/slow/` | A delayed first paint and a real layout shift — bad LCP and CLS |
| `/contact/` | The end of a journey |
| `404.html` | Unmatched URLs, served by Pages and tracked like any other page |

## Setup

The whole configuration is one file:

```json
{
  "collectorUrl": "https://interalliance-web-traffic.onrender.com",
  "siteKey": "PASTE_SITE_KEY_FROM_DASHBOARD"
}
```

Get the key from your IA-Counter dashboard under **Sites → Snippet**, paste it
into `site.config.json`, then rebuild:

```bash
node build.mjs
```

Commit the regenerated `docs/` and push. GitHub Pages serves from that folder.

Requires Node 18+. There are no dependencies.

## Repository layout

```
build.mjs          generates docs/ — page content and layout both live here
site.config.json   collector URL and site key
assets/            style.css and favicon.svg, copied verbatim
docs/              the generated site; this is what Pages serves
```

`docs/` is committed on purpose. GitHub Pages serves a folder from the default
branch, so the built output has to be in the repo — there is no build step on
their side.

## Enabling Pages

**Settings → Pages → Source: Deploy from a branch → `main` / `/docs`.**

The site appears at `https://<user>.github.io/test-site-counter/` within a
minute or so.

### Base path

A project page is served from `/test-site-counter/`, not from the domain root,
so every absolute link needs that prefix or it 404s. `basePath` in
`site.config.json` handles it and is already set for this repo name.

Clear it (`"basePath": ""`) and rebuild if you move the site to the root — a
custom domain, or a `<user>.github.io` repo. If you rename the repository,
update it to match.

For a custom domain, also set `customDomain` and a `CNAME` file is emitted
automatically.

## Privacy

No cookies, no `localStorage`, no persistent identifiers. The tracker honours
Global Privacy Control and Do Not Track by default, and query strings are
stripped in the browser before anything is sent.
