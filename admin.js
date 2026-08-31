// A small admin for the people who do not speak MCP.
//
// Agents edit sites over /mcp; a human wants to see the list, click a site and
// change a line. Both go through the same store, so neither has a private path
// to the content and an agent's write is visible in the editor immediately.

const crypto = require('crypto');
const store = require('./store');

const COOKIE = 'lobby_admin';
const sessions = new Map();          // token -> expiry
const SESSION_MS = 12 * 60 * 60 * 1000;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function enabled() {
  return !!process.env.LOBBY_ADMIN_PASSWORD;
}

function adminUser() {
  return process.env.LOBBY_ADMIN_USER || 'admin';
}

// Constant-time compare so a wrong password cannot be found a character at a
// time by measuring how long the answer takes.
function sameSecret(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function newSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_MS);
  return token;
}

function isLoggedIn(req) {
  const raw = req.headers.cookie || '';
  const m = new RegExp(`${COOKIE}=([a-f0-9]{64})`).exec(raw);
  if (!m) return false;
  const expiry = sessions.get(m[1]);
  if (!expiry) return false;
  if (expiry < Date.now()) { sessions.delete(m[1]); return false; }
  return true;
}

const CSS = `
:root { --bg:#0f1319; --fg:#e6eaf0; --muted:#93a1b4; --line:#232b36; --accent:#5b8cff; --soft:#161c25; --danger:#f87171; }
@media (prefers-color-scheme: light) {
  :root { --bg:#f7f9fc; --fg:#131820; --muted:#5b6878; --line:#dfe5ee; --accent:#2f5fd0; --soft:#ffffff; --danger:#c62828; }
}
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
header { border-bottom:1px solid var(--line); padding:1rem 1.5rem; display:flex; align-items:center; gap:1rem; }
header h1 { font-size:1.05rem; margin:0; letter-spacing:-.01em; }
header .spacer { flex:1; }
main { max-width:1000px; margin:0 auto; padding:1.75rem 1.5rem 4rem; }
a { color:var(--accent); }
table { width:100%; border-collapse:collapse; }
th, td { text-align:left; padding:.7rem .6rem; border-bottom:1px solid var(--line); vertical-align:top; }
th { font-size:.75rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); font-weight:600; }
td.host { font-family:ui-monospace,Menlo,Consolas,monospace; }
.tag { display:inline-block; font-size:.72rem; padding:.12rem .5rem; border-radius:999px; border:1px solid var(--line); color:var(--muted); }
.tag.live { color:#34d399; border-color:#34d39955; }
.tag.nodomain { color:#fbbf24; border-color:#fbbf2455; }
.tag.nofile { color:var(--danger); border-color:var(--danger); }
.btn { display:inline-block; padding:.5rem 1rem; border-radius:8px; border:1px solid var(--accent); background:var(--accent); color:#fff; text-decoration:none; font-weight:600; font-size:.9rem; cursor:pointer; }
.btn.ghost { background:transparent; color:var(--accent); }
.btn.danger { background:transparent; border-color:var(--danger); color:var(--danger); }
input, textarea { width:100%; background:var(--soft); color:var(--fg); border:1px solid var(--line); border-radius:8px; padding:.6rem .7rem; font:inherit; }
textarea { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:13.5px; line-height:1.6; min-height:65vh; resize:vertical; }
label { display:block; font-size:.78rem; text-transform:uppercase; letter-spacing:.07em; color:var(--muted); margin:1rem 0 .35rem; }
.row { display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; margin-top:1rem; }
.note { color:var(--muted); font-size:.86rem; }
.err { color:var(--danger); }
form.inline { display:inline; }
`;

function shell(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title><style>${CSS}</style></head><body>
<header><h1>Lobby admin</h1><span class="spacer"></span>
<a class="btn ghost" href="/admin">All sites</a>
<form class="inline" method="post" action="/admin/logout"><button class="btn ghost" type="submit">Sign out</button></form>
</header><main>${body}</main></body></html>`;
}

function loginPage(message) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Lobby admin</title><style>${CSS}</style></head><body>
<main style="max-width:380px;padding-top:14vh">
<h1 style="font-size:1.3rem;margin:0 0 .3rem">Lobby admin</h1>
<p class="note">Sign in to edit the sites this hotel serves.</p>
${message ? `<p class="err">${esc(message)}</p>` : ''}
<form method="post" action="/admin/login">
<label for="u">User</label><input id="u" name="user" autocomplete="username" value="${esc(adminUser())}">
<label for="p">Password</label><input id="p" name="password" type="password" autocomplete="current-password" autofocus>
<div class="row"><button class="btn" type="submit">Sign in</button></div>
</form></main></body></html>`;
}

function listPage() {
  const sites = store.list();
  const domains = store.configuredDomains();
  const haveFile = new Set(sites.map(s => s.host));

  const rows = sites.map(s => {
    const live = domains.length === 0 ? null : domains.includes(s.host);
    const tag = s.host === 'default'
      ? '<span class="tag">fallback</span>'
      : live === null ? ''
      : live ? '<span class="tag live">live</span>'
             : '<span class="tag nodomain">no domain</span>';
    return `<tr>
      <td class="host"><a href="/admin/edit?host=${encodeURIComponent(s.host)}">${esc(s.host)}</a></td>
      <td>${esc(s.title)}</td>
      <td>${tag}</td>
      <td class="note">${(s.bytes / 1024).toFixed(1)} kB · ${esc(s.updated.slice(0, 16).replace('T', ' '))}</td>
    </tr>`;
  }).join('');

  // A domain the hotel answers to with no file behind it is the failure that
  // is hardest to notice: the visitor gets the default site and nothing looks
  // broken. Listing it is the whole reason the admin knows about domains.
  const missing = domains.filter(d => !haveFile.has(d)).map(d => `<tr>
      <td class="host">${esc(d)}</td><td class="note">routed here, no file yet</td>
      <td><span class="tag nofile">no file</span></td>
      <td><a class="btn ghost" href="/admin/edit?host=${encodeURIComponent(d)}&amp;new=1">Create</a></td>
    </tr>`).join('');

  return shell('Sites', `
    <table>
      <tr><th>Hostname</th><th>Title</th><th></th><th>Size · updated</th></tr>
      ${rows}${missing}
    </table>
    <div class="row">
      <form method="get" action="/admin/edit" class="row" style="margin:0">
        <input name="host" placeholder="new-site.example.com" style="width:260px">
        <input type="hidden" name="new" value="1">
        <button class="btn" type="submit">New site</button>
      </form>
    </div>
    <p class="note" style="margin-top:1.5rem">${domains.length
      ? `This hotel answers to ${domains.length} hostname${domains.length === 1 ? '' : 's'}, as configured in AgentHotel.`
      : 'No hostname list was passed to this container, so "live" cannot be shown. Set AGENTHOTEL_DOMAINS to see which sites are actually routed here.'}</p>
  `);
}

function editPage(host, { content, version, error, isNew }) {
  return shell(`Edit ${host}`, `
    <p class="note"><a href="/admin">← All sites</a></p>
    <h2 style="margin:.2rem 0 .1rem;font-size:1.2rem;font-family:ui-monospace,monospace">${esc(host)}</h2>
    <p class="note">${isNew ? 'New site — it goes live as soon as a hostname is routed here.' : `<a href="https://${esc(host)}/" target="_blank" rel="noreferrer">Open the site ↗</a> · <a href="https://${esc(host)}/site.md" target="_blank" rel="noreferrer">source</a>`}</p>
    ${error ? `<p class="err">${esc(error)}</p>` : ''}
    <form method="post" action="/admin/save">
      <input type="hidden" name="host" value="${esc(host)}">
      <input type="hidden" name="version" value="${esc(version || '')}">
      <label for="c">Markdown source</label>
      <textarea id="c" name="content" spellcheck="false">${esc(content)}</textarea>
      <div class="row">
        <button class="btn" type="submit">Save</button>
        ${isNew ? '' : `<button class="btn danger" type="submit" formaction="/admin/delete"
           onclick="return confirm('Delete ${esc(host)}? The file is removed for good.')">Delete site</button>`}
      </div>
    </form>
  `);
}

function send(res, status, html, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(html);
}

function redirect(res, to, headers = {}) {
  res.writeHead(303, { Location: to, ...headers });
  res.end();
}

function form(body) {
  const params = new URLSearchParams(body || '');
  return Object.fromEntries(params.entries());
}

function handle(req, res, url, body) {
  if (!enabled()) {
    return send(res, 404, shell('Disabled', '<p class="note">The admin is off. Set LOBBY_ADMIN_PASSWORD to enable it.</p>'));
  }

  const p = url.pathname;

  if (p === '/admin/login' && req.method === 'POST') {
    const f = form(body);
    if (f.user === adminUser() && sameSecret(f.password || '', process.env.LOBBY_ADMIN_PASSWORD)) {
      const token = newSession();
      return redirect(res, '/admin', {
        'Set-Cookie': `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}; Secure`
      });
    }
    return send(res, 401, loginPage('Wrong user or password.'));
  }

  if (!isLoggedIn(req)) return send(res, 200, loginPage(null));

  if (p === '/admin/logout' && req.method === 'POST') {
    return redirect(res, '/admin', { 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0` });
  }

  if (p === '/admin' || p === '/admin/') return send(res, 200, listPage());

  if (p === '/admin/edit') {
    const host = store.safeHost(url.searchParams.get('host'));
    if (!host) return send(res, 400, shell('Bad host', '<p class="err">That is not a valid hostname.</p><p><a href="/admin">Back</a></p>'));
    const existing = store.read(host);
    if (existing) return send(res, 200, editPage(host, { content: existing.content, version: existing.version }));
    return send(res, 200, editPage(host, { content: starter(host), version: '', isNew: true }));
  }

  if (p === '/admin/save' && req.method === 'POST') {
    const f = form(body);
    const host = store.safeHost(f.host);
    if (!host) return send(res, 400, shell('Bad host', '<p class="err">That is not a valid hostname.</p>'));
    try {
      store.write(host, f.content, f.version || undefined);
      return redirect(res, `/admin/edit?host=${encodeURIComponent(host)}&saved=1`);
    } catch (err) {
      const current = store.read(host);
      return send(res, err.conflict ? 409 : 400, editPage(host, {
        content: f.content,
        version: current ? current.version : '',
        error: err.conflict
          ? 'Someone else — or an agent — saved this site while you were editing. Your text is still here; saving again will overwrite theirs.'
          : err.message
      }));
    }
  }

  if (p === '/admin/delete' && req.method === 'POST') {
    const host = store.safeHost(form(body).host);
    if (host) store.remove(host);
    return redirect(res, '/admin');
  }

  return send(res, 404, shell('Not found', '<p class="note">No such page. <a href="/admin">All sites</a></p>'));
}

function starter(host) {
  return `---
title: "${host}"
description: ""
theme: default
---

::hero{eyebrow=""}
# A headline worth the visit.

## One sentence that says what this is and who it is for.

[Primary action](#){.primary} [Secondary](#){.ghost}
::

::text
Write the rest here. Anything outside a block is ordinary markdown.
::
`;
}

module.exports = { handle, enabled, isLoggedIn };
