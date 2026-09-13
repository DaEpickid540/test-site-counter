/**
 * Generates the static site into docs/, which is what GitHub Pages serves.
 *
 * Everything about the site lives in this one file, so changing the collector
 * URL or the site key is a single edit to site.config.json followed by:
 *
 *   node build.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(ROOT, 'docs');

const config = JSON.parse(readFileSync(resolve(ROOT, 'site.config.json'), 'utf8'));
const { collectorUrl, siteKey } = config;

// A GitHub *project* page is served from /<repo>/, not from the domain root,
// so every absolute path has to carry that prefix or it 404s. Left empty for
// a custom domain or a <user>.github.io repo, where the site is at the root.
const base = (config.basePath || '').replace(/\/+$/, '');

if (!siteKey || siteKey.startsWith('PASTE_')) {
  console.warn(
    '\n  ! siteKey is not set in site.config.json.\n' +
      '    The pages will still build, but nothing will be tracked until you\n' +
      '    paste the key from your dashboard (Sites -> Snippet) and re-run this.\n'
  );
}

/* ------------------------------------------------------------------- pages */

const NAV = [
  ['/', 'Home'],
  ['/programs/', 'Programs'],
  ['/techolympics/', 'TechOlympics'],
  ['/about/', 'About'],
  ['/app/', 'SPA demo'],
  ['/slow/', 'Slow page'],
  ['/contact/', 'Contact']
];

const PAGES = [
  {
    out: 'index.html',
    path: '/',
    title: 'Home',
    lede: 'A real website on the real internet, built to be measured.',
    body: `
      <p>Every link in the nav is a separate page served by GitHub Pages, and
      every one of them reports to an IA-Counter instance running somewhere
      else entirely. That is the whole point of this site: it exercises the
      real cross-origin path, over HTTPS, from a real CDN.</p>
      <div class="cards">
        <a class="card" href="/programs/"><h3>Programs</h3><p>An ordinary page, an ordinary pageview.</p></a>
        <a class="card" href="/app/"><h3>SPA demo</h3><p>Client-side routes with no page reload.</p></a>
        <a class="card" href="/slow/"><h3>Slow page</h3><p>Deliberately poor Core Web Vitals.</p></a>
      </div>
      <p class="note">Open the dashboard alongside this and click around. Pageviews
      land within a couple of seconds.</p>`
  },
  {
    out: 'programs/index.html',
    path: '/programs/',
    title: 'Programs',
    lede: 'A normal content page.',
    body: `<p>Nothing clever happens here. It exists so the Pages breakdown has
      more than one row in it.</p>
      <p>Open this page directly in a fresh tab and it is recorded as direct
      traffic. Arrive by clicking the nav link and it is an internal navigation,
      which the tracker deliberately does <em>not</em> record as a referrer —
      your own site is not an acquisition source.</p>`
  },
  {
    out: 'techolympics/index.html',
    path: '/techolympics/',
    title: 'TechOlympics',
    lede: 'Campaign tracking, without leaking the query string.',
    body: `<p>Add UTM parameters to this URL and reload. The recorded path stays
      clean at <code>/techolympics/</code>, but the campaign is captured and shows
      up under <strong>Referrers &rarr; Source</strong> in the dashboard.</p>
      <p><a class="btn-link" href="/techolympics/?utm_source=newsletter&utm_medium=email&utm_campaign=live-test">
      Reload with a campaign attached &rarr;</a></p>
      <p class="note">Query strings are stripped in the browser before anything is
      sent, because they leak email addresses, tokens and search terms more often
      than people expect. UTM parameters are the deliberate exception.</p>`
  },
  {
    out: 'about/index.html',
    path: '/about/',
    title: 'About',
    lede: 'Short page. Quick to read, quick to leave.',
    body: `<p>If you open this page and immediately close the tab, it counts as a
      bounce — a visit where exactly one page was seen that day.</p>
      <p>The time-on-page beacon fires when the tab is hidden or closed, so
      switching to another tab is what actually commits the duration. Sitting here
      reading does not report anything until you leave.</p>`
  },
  {
    out: 'contact/index.html',
    path: '/contact/',
    title: 'Contact',
    lede: 'The end of a typical journey through a site.',
    body: `<p>On a real site this would be the conversion page, and the one you
      would care about in the funnel.</p>
      <p>There is no form here on purpose — nothing on this site collects anything
      from you.</p>`
  },
  {
    out: 'app/index.html',
    path: '/app/',
    title: 'SPA demo',
    lede: 'Client-side routing, tracked without a page reload.',
    body: `
      <p>These buttons change the URL with <code>history.pushState()</code> and
      never reload the page. The tracker patches pushState, so each one is
      recorded as its own pageview.</p>
      <p>Only the <em>first</em> view carries the document's load timings. The
      later ones did not load anything, so reporting a TTFB for them would be
      attributing the landing page's numbers to a route that never touched the
      network.</p>
      <nav class="routes">
        <button data-route="/app/dashboard">/app/dashboard</button>
        <button data-route="/app/settings">/app/settings</button>
        <button data-route="/app/billing">/app/billing</button>
      </nav>
      <div class="panel"><strong>Current route:</strong> <span id="route">/app/</span></div>
      <p><button id="lag" class="danger">Block the main thread for 300ms</button>
      &nbsp;registers a slow interaction, which is what INP measures.</p>`,
    script: `
      document.querySelectorAll('[data-route]').forEach(function (b) {
        b.addEventListener('click', function () {
          history.pushState({}, '', b.dataset.route);
          document.getElementById('route').textContent = b.dataset.route;
          document.title = b.dataset.route + ' — Counter Test Site';
        });
      });
      document.getElementById('lag').addEventListener('click', function () {
        var end = Date.now() + 300;
        while (Date.now() < end) { /* deliberately janky */ }
        this.textContent = 'Blocked for 300ms — check INP';
      });`
  },
  {
    out: 'slow/index.html',
    path: '/slow/',
    title: 'Slow page',
    lede: 'Bad on purpose, so the Core Web Vitals cards have something to say.',
    body: `<p>This page blocks rendering for about 600ms before it paints, then
      drops an unsized banner in a second later. That gives you a genuinely poor
      LCP and a real layout shift.</p>
      <div id="late"></div>
      <p>This paragraph is what gets shoved down the page when the banner arrives.
      That downward shove is exactly what CLS measures — content moving under a
      reader who has already started reading.</p>
      <p class="note">TTFB will still look fine here. This is served by GitHub's
      CDN, and no amount of client-side sabotage can make a CDN slow to respond.</p>`,
    // A render-blocking busy-wait in the head is crude, but it is the only way
    // to delay first paint on static hosting.
    headScript: `
      (function () {
        var end = Date.now() + 600;
        while (Date.now() < end) { /* stall first paint */ }
      })();`,
    script: `
      setTimeout(function () {
        var d = document.createElement('div');
        d.className = 'late-banner';
        d.textContent = 'Late banner — everything below this just moved';
        document.getElementById('late').appendChild(d);
      }, 1000);`
  },
  {
    out: '404.html',
    path: '/404',
    title: 'Not found',
    lede: 'There is no page here.',
    body: `<p>GitHub Pages serves this file for any unmatched URL, and the tracker
      records it like any other pageview. On a real site this list is worth
      watching — it is where you find broken inbound links.</p>
      <p><a class="btn-link" href="/">Back home &rarr;</a></p>`
  }
];

/* ------------------------------------------------------------------ layout */

function layout(page) {
  const nav = NAV.map(
    ([href, label]) =>
      `<a href="${href}"${href === page.path ? ' class="on" aria-current="page"' : ''}>${label}</a>`
  ).join('\n      ');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${page.title} — Counter Test Site</title>
<meta name="description" content="A test site for IA-Counter, a privacy-first web analytics tool.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/style.css">
${page.headScript ? `<script>${page.headScript}</script>` : ''}
</head>
<body>

<header>
  <a class="brand" href="/">COUNTER<span>//</span>TEST</a>
  <nav class="main">
      ${nav}
  </nav>
</header>

<main>
  <h1>${page.title}</h1>
  <p class="lede">${page.lede}</p>
  ${page.body}
</main>

<footer>
  <p>Not a real organisation. This site exists only to generate pageviews for
  <a href="https://github.com/${config.counterRepo}">IA-Counter</a>.</p>
  <p class="tiny">No cookies are set and nothing is stored in your browser.
  Reporting to <code>${collectorUrl}</code>.</p>
</footer>
${page.script ? `<script>${page.script}</script>` : ''}

<!-- This single tag is the entire installation. -->
<script defer src="${collectorUrl}/ia.js" data-site="${siteKey}"></script>
</body>
</html>
`;

  // Prefix every root-relative link and asset with the base path. The tracker
  // src is a full URL so it does not start with "/" and is left alone.
  return base ? html.replace(/(href|src)="\//g, `$1="${base}/`) : html;
}

/* ------------------------------------------------------------------- build */

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const page of PAGES) {
  const dest = join(OUT, page.out);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, layout(page));
}

// Static assets copied verbatim.
for (const asset of ['style.css', 'favicon.svg']) {
  const src = resolve(ROOT, 'assets', asset);
  if (existsSync(src)) cpSync(src, join(OUT, asset));
}

// Tells GitHub Pages to serve the files as-is rather than running them
// through Jekyll, which would ignore any directory starting with an underscore.
writeFileSync(join(OUT, '.nojekyll'), '');

if (config.customDomain) {
  writeFileSync(join(OUT, 'CNAME'), config.customDomain + '\n');
}

console.log(`Built ${PAGES.length} pages into docs/`);
console.log(`  collector  ${collectorUrl}`);
console.log(`  site key   ${siteKey}`);
