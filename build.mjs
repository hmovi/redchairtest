// Build step for Vercel: pre-renders every page into its own HTML file so Google
// can index each one at a real URL (/seo, /pricing, ...). The browser still runs the
// same script afterwards, so the site behaves exactly as before.
// Run locally with: node build.mjs   (output goes to ./dist)
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const OUT = 'dist';
const SITE = 'https://www.redchairmarketing.ca';
const src = fs.readFileSync('index.html', 'utf8');

// Pull the page templates (P), titles (T), descriptions (D) and routes (RT) out of the inline script.
const script = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('const P='));
const defs = script.slice(0, script.indexOf('const pathKey='));
const { P, T, D, RT, I } = vm.runInNewContext(defs + ';({P,T,D,RT,I})', {
  matchMedia: () => ({ matches: false }), document: {}, window: {}, location: { hash: '', pathname: '/' }, navigator: {},
});

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const title = k => k === 'home' ? 'Digital Marketing in Vancouver, Whistler & Squamish | Red Chair Marketing' : `${T[k]} | Red Chair Marketing`;
const NAMES = { seo: 'SEO', website: 'Website development', social: 'Social media management', ecommerce: 'E-commerce management', content: 'Content creation', merchandise: 'Merchandise', work: 'Our work', about: 'About us', pricing: 'Pricing' };
const SERVICES = ['seo', 'website', 'social', 'ecommerce', 'content', 'merchandise'];

function page(k, { notFound = false } = {}) {
  let h = src;
  const url = SITE + RT[k];
  const t = notFound ? 'Page not found | Red Chair Marketing' : title(k);
  const d = D[k] || D.home;
  const set = (re, val) => { if (!re.test(h)) throw new Error('head tag missing: ' + re); h = h.replace(re, val); };
  set(/<title>[\s\S]*?<\/title>/, `<title>${esc(t)}</title>`);
  set(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(d)}">`);
  set(/<link rel="canonical" href="[^"]*">/, notFound ? '' : `<link rel="canonical" href="${url}">`);
  set(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`);
  set(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(t)}">`);
  set(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(d)}">`);
  set(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(t)}">`);
  set(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(d)}">`);
  if (notFound) set(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex">');

  // Extra structured data per page: breadcrumbs, plus a Service entry on service pages.
  const extra = [];
  if (k !== 'home' && !notFound) {
    extra.push({ '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: NAMES[k], item: url }] });
    extra.push({ '@type': 'WebPage', '@id': url + '#webpage', url, name: t, description: d, isPartOf: { '@id': SITE + '/#website' }, inLanguage: 'en-CA' });
  }
  if (SERVICES.includes(k)) {
    extra.push({ '@type': 'Service', name: NAMES[k], serviceType: NAMES[k], description: d, url,
      provider: { '@id': SITE + '/#organization' },
      areaServed: ['Vancouver', 'Whistler', 'Squamish'].map(n => ({ '@type': 'City', name: n })) });
  }
  if (extra.length) h = h.replace('</head>', `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': extra })}</script>\n</head>`);

  // Start downloading the hero photo before the page script runs.
  const heroKey = (P[k]().match(/<section class="hero[^>]*>[\s\S]*?src="([^"]+)"/) || [])[1];
  if (heroKey && heroKey.startsWith('/_vercel/image')) {
    const srcset = (P[k]().match(/<section class="hero[^>]*>[\s\S]*?srcset="([^"]+)"/) || [])[1];
    if (srcset) h = h.replace('</head>', `<link rel="preload" as="image" imagesrcset="${srcset}" imagesizes="100vw" fetchpriority="high">\n</head>`);
  }

  // Pre-render the page body.
  let body = P[k]();
  if (notFound) body = `<section style="padding:160px 0 120px"><div class="w"><h1>Page not found.</h1><p class="lead mut" style="margin-top:18px">The page you’re looking for has moved or doesn’t exist.</p><div class="bs" style="margin-top:28px"><a class="btn r" href="/">Go to the home page</a> <a class="btn o" href="/pricing">See pricing</a></div></div></section>`;
  set(/<main id="m">[\s\S]*?<\/main>/, `<main id="m">${body}</main>`);
  return h;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);

// Static files to publish (patches, build files and unused assets stay out).
const copy = ['theme.css', 'motion.css', 'motion.js', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og-image.jpg', 'robots.txt', 'site.webmanifest'];
for (const f of copy) if (fs.existsSync(f)) fs.copyFileSync(f, path.join(OUT, f));
if (fs.existsSync('assets')) fs.cpSync('assets', path.join(OUT, 'assets'), { recursive: true, filter: p => !p.includes(path.join('assets', 'globe')) });

for (const k of Object.keys(RT)) {
  const file = k === 'home' ? 'index.html' : RT[k].slice(1) + '.html';
  fs.writeFileSync(path.join(OUT, file), page(k));
}
fs.writeFileSync(path.join(OUT, '404.html'), page('home', { notFound: true }));

const today = new Date().toISOString().slice(0, 10);
const pri = k => k === 'home' ? '1.0' : SERVICES.includes(k) || k === 'pricing' ? '0.8' : '0.6';
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Object.keys(RT).map(k => `  <url><loc>${SITE}${RT[k]}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>${pri(k)}</priority></url>`).join('\n')}
</urlset>
`);
console.log('Built', Object.keys(RT).length, 'pages + 404 into', OUT);
