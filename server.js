// A hotel for landing pages: one process, many domains.
//
// The request's Host decides which markdown file is the site, exactly the way
// AgentHotel's Caddy picks a guest by hostname. There is no database — a site
// is a file, so publishing is writing one, and backing up is copying a folder.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { parseFrontmatter, parseBlocks, renderBlocks, escapeHtml } = require('./render');
const styles = require('./styles');
const { themeCss } = require('./themes');
const mcp = require('./mcp');
const admin = require('./admin');
const store = require('./store');

const SITES_DIR = process.env.SITES_DIR || path.join(__dirname, 'sites');
const SEED_DIR = '/seed';
const PORT = parseInt(process.env.PORT) || 8080;
// Unknown hostnames answer 404. A catch-all is available by naming a file in
// DEFAULT_SITE, but it is not the default behaviour: with a wildcard route
// every possible subdomain reaches this process, so falling back silently
// means a typo in a link always renders a page and never a mistake.
const DEFAULT_SITE = process.env.DEFAULT_SITE || '';
// Writing a site publishes it, so the MCP endpoint stays closed until an
// operator sets a token. Absent one there is nothing to guess at.
const API_TOKEN = process.env.LOBBY_API_TOKEN || '';

// The sites folder is a volume, so it starts empty on a fresh deploy. Copying
// the seed in only when a name is missing means an edited site is never
// overwritten by a redeploy.
function seedSites() {
  if (!fs.existsSync(SITES_DIR)) fs.mkdirSync(SITES_DIR, { recursive: true });
  if (!fs.existsSync(SEED_DIR)) return;
  for (const name of fs.readdirSync(SEED_DIR)) {
    const dest = path.join(SITES_DIR, name);
    if (!fs.existsSync(dest)) fs.copyFileSync(path.join(SEED_DIR, name), dest);
  }
}

// A hostname reaches the filesystem, so it is treated as hostile: lowercased,
// port stripped, and restricted to what a domain may actually contain. Without
// this a Host header of "../../etc/passwd" is a file read.
function siteNameFor(host) {
  const bare = String(host || '').toLowerCase().split(':')[0].replace(/\.$/, '');
  if (!/^[a-z0-9.-]+$/.test(bare) || bare.includes('..')) return null;
  return bare;
}

function findSiteFile(host) {
  const name = siteNameFor(host);
  const candidates = [];
  if (name) {
    candidates.push(`${name}.md`);
    // www.example.com falls back to example.com, so one file serves both.
    if (name.startsWith('www.')) candidates.push(`${name.slice(4)}.md`);
  }
  if (DEFAULT_SITE) candidates.push(`${DEFAULT_SITE}.md`);
  for (const c of candidates) {
    const p = path.join(SITES_DIR, c);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

function page(meta, bodyHtml, siteName) {
  const title = meta.title || siteName;
  const desc = meta.description || '';
  return `<!doctype html>
<html lang="${escapeHtml(meta.lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${desc ? `<meta name="description" content="${escapeHtml(desc)}">` : ''}
<meta property="og:title" content="${escapeHtml(title)}">
${desc ? `<meta property="og:description" content="${escapeHtml(desc)}">` : ''}
<style>${styles}</style>
<style>${themeCss(meta.theme)}</style>
</head>
<body>
<main>
${bodyHtml}
</main>
${meta.footer ? `<footer>${escapeHtml(meta.footer)}</footer>` : ''}
</body>
</html>`;
}

// A missing site is a real 404, and the page says which hostname was asked
// for — the useful fact when a link is wrong. An admin who is signed in gets
// the one thing they would otherwise go looking for: a link that creates it.
function notFound(req, res) {
  const host = siteNameFor(req.headers.host) || '';
  const canCreate = host && admin.enabled() && admin.isLoggedIn(req);
  const body = `<section class="block hero">
    <p class="eyebrow">404</p>
    <h1>No site lives here.</h1>
    <h2>Nothing is published for <code>${escapeHtml(host || 'this hostname')}</code>.</h2>
    ${canCreate ? `<p class="actions"><a class="btn btn-primary" href="/admin/edit?host=${encodeURIComponent(host)}&new=1">Create this site</a></p>` : ''}
  </section>`;
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(page({ title: `No site for ${host}` }, body, host));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // The human half of the same job. Agents write over /mcp, people click here,
  // and both go through the same store so neither has a private copy.
  if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2_000_000) req.destroy(); });
    req.on('end', () => admin.handle(req, res, url, body));
    return;
  }

  // An agent operates the hotel here. It is host-independent on purpose: the
  // endpoint manages every site, so which hostname the request arrived on is
  // irrelevant.
  if (url.pathname === '/mcp') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST' });
      return res.end(JSON.stringify({ error: 'POST a JSON-RPC request' }));
    }
    let body = '';
    req.on('data', c => {
      body += c;
      // A CMS write is small. Anything enormous is a mistake or an attack.
      if (body.length > 2_000_000) { req.destroy(); }
    });
    req.on('end', () => mcp.handle(req, res, body, { sitesDir: SITES_DIR, token: API_TOKEN }));
    return;
  }

  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok\n');
  }

  const file = findSiteFile(req.headers.host);
  if (!file) return notFound(req, res);

  // Serving the source verbatim is the point of the format, not a debug hatch:
  // an agent or an LLM reads the same text a human edits.
  if (url.pathname === '/site.md') {
    res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
    return res.end(fs.readFileSync(file));
  }

  try {
    const src = fs.readFileSync(file, 'utf8');
    const { meta, body } = parseFrontmatter(src);
    const isAdmin = admin.enabled() && admin.isLoggedIn(req);
    const html = renderBlocks(parseBlocks(body), { isAdmin });
    const editable = isAdmin
      ? `<a href="/admin/edit?host=${encodeURIComponent(path.basename(file, '.md'))}" style="position:fixed;right:1rem;bottom:1rem;z-index:9;background:#111;color:#fff;padding:.55rem 1rem;border-radius:999px;text-decoration:none;font:600 14px/1 ui-sans-serif,system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3)">Edit this page</a>`
      : '';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(page(meta, html + editable, path.basename(file, '.md')));
  } catch (err) {
    console.error(`[render] ${file}: ${err.message}`);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Could not render this site\n');
  }
});

seedSites();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`markdown-hotel listening on ${PORT}, sites in ${SITES_DIR}`);
});
