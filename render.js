// A site is one markdown file. This turns it into HTML.
//
// The format is markdownweb's: optional YAML-ish frontmatter, then blocks
// written as ::name{attr="value"} … :: with markdown inside. Anything outside
// a block is a text block, so a plain markdown file renders fine with no
// directives at all — that is the floor we never want to fall below.

const { marked } = require('marked');
const store = require('./store');

marked.setOptions({ mangle: false, headerIds: false });

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Frontmatter is three dashes, then key: value lines. Deliberately not a YAML
// parser: a site's header is a handful of strings, and a real parser would be
// the largest dependency in the project.
function parseFrontmatter(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body: src.slice(m[0].length) };
}

// ::name{a="b" c=3} — quoted values may contain spaces, bare ones may not.
function parseAttrs(raw) {
  const attrs = {};
  if (!raw) return attrs;
  const re = /([A-Za-z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s}]+))/g;
  let m;
  while ((m = re.exec(raw))) attrs[m[1]] = m[2] ?? m[3] ?? m[4];
  return attrs;
}

function parseBlocks(body) {
  const blocks = [];
  const open = /^::([a-z][a-z0-9-]*)(\{[^\n]*\})?\s*$/im;
  let rest = body;

  while (rest.length) {
    const m = open.exec(rest);
    if (!m) { pushText(blocks, rest); break; }

    pushText(blocks, rest.slice(0, m.index));
    const after = rest.slice(m.index + m[0].length);
    // A block ends at a line that is exactly "::". An unclosed block runs to
    // the end of the file rather than swallowing the page silently.
    const close = /^::\s*$/m.exec(after);
    const inner = close ? after.slice(0, close.index) : after;
    blocks.push({ type: m[1].toLowerCase(), attrs: parseAttrs(m[2]), body: inner.trim() });
    rest = close ? after.slice(close.index + close[0].length) : '';
  }
  return blocks;
}

function pushText(blocks, text) {
  if (text && text.trim()) blocks.push({ type: 'text', attrs: {}, body: text.trim() });
}

// Links written as [label](/href){.primary} become buttons; the class marks
// intent, so a hero's call to action is styled without inventing new syntax.
function extractActions(md) {
  const actions = [];
  const rest = md.replace(/\[([^\]]+)\]\(([^)]+)\)\{\.([a-z]+)\}/g, (_, label, href, kind) => {
    actions.push({ label, href, kind });
    return '';
  });
  return { actions, rest };
}

function actionsHtml(actions) {
  if (!actions.length) return '';
  return `<p class="actions">${actions.map(a =>
    `<a class="btn btn-${escapeHtml(a.kind)}" href="${escapeHtml(a.href)}">${escapeHtml(a.label)}</a>`
  ).join('')}</p>`;
}

function md(src) {
  return marked.parse(src || '');
}


// Several blocks are lists of small records. Written as markdown lists so the
// file still reads as prose, in two shapes:
//
//   - Label → /href                       (nav, footer: a link)
//   - title: Agents author                (features, pricing, faq: fields)
//     body: MCP exposes 40+ skills
//
// Deliberately not YAML. These are a handful of one-line values, and a real
// parser would be the largest dependency in the project for no gain.
function parseItems(body) {
  const items = [];
  let current = null;
  for (const raw of String(body || '').split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;

    const start = /^\s*-\s+(.*)$/.exec(line);
    if (start) {
      current = {};
      items.push(current);
      const kv = /^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(start[1]);
      if (kv) { current[kv[1].toLowerCase()] = kv[2].trim(); continue; }
      // "Label → /href" or "Label -> /href"
      const link = /^(.*?)\s*(?:→|->)\s*(\S+)$/.exec(start[1]);
      if (link) { current.label = link[1].trim(); current.href = link[2].trim(); continue; }
      current.label = start[1].trim();
      continue;
    }

    const cont = /^\s+([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (cont && current) { current[cont[1].toLowerCase()] = cont[2].trim(); continue; }
    // A plain continuation line extends whichever field came last.
    if (current) {
      const keys = Object.keys(current);
      if (keys.length) current[keys[keys.length - 1]] += ' ' + line.trim();
    }
  }
  return items;
}

function inline(text) {
  // marked wraps a lone line in <p>; inside a card that is unwanted markup.
  return md(text).replace(/^<p>|<\/p>\s*$/g, '').trim();
}

const renderers = {
  hero(b) {
    const { actions, rest } = extractActions(b.body);
    const eyebrow = b.attrs.eyebrow
      ? `<p class="eyebrow">${escapeHtml(b.attrs.eyebrow)}</p>` : '';
    return `<section class="block hero">${eyebrow}${md(rest)}${actionsHtml(actions)}</section>`;
  },

  // "split" is markdownweb's name; "two-column" is the same thing said plainly.
  split(b) {
    const { actions, rest } = extractActions(b.body);
    const eyebrow = b.attrs.eyebrow
      ? `<p class="eyebrow">${escapeHtml(b.attrs.eyebrow)}</p>` : '';
    const media = b.attrs.image
      ? `<div class="split-media"><img src="${escapeHtml(b.attrs.image)}" alt="${escapeHtml(b.attrs.imageAlt || '')}" loading="lazy"></div>`
      : '';
    const flip = b.attrs.reverse === 'true' ? ' split-reverse' : '';
    return `<section class="block split${flip}">`
      + `<div class="split-text">${eyebrow}${md(rest)}${actionsHtml(actions)}</div>${media}</section>`;
  },

  cta(b) {
    const { actions, rest } = extractActions(b.body);
    return `<section class="block cta"><div class="cta-inner">${md(rest)}${actionsHtml(actions)}</div></section>`;
  },

  text(b) {
    const { actions, rest } = extractActions(b.body);
    return `<section class="block text">${md(rest)}${actionsHtml(actions)}</section>`;
  },

  // A landing page usually has a header. Sticky, because a long page without
  // one strands the reader at the bottom.
  nav(b) {
    const brand = b.attrs.brand
      ? `<a class="nav-brand" href="${escapeHtml(b.attrs.home || '/')}">${escapeHtml(b.attrs.brand)}</a>` : '';
    const links = parseItems(b.body)
      .filter(i => i.label)
      .map(i => `<a href="${escapeHtml(i.href || '#')}">${escapeHtml(i.label)}</a>`)
      .join('');
    return `<nav class="site-nav"><div class="nav-inner">${brand}<div class="nav-links">${links}</div></div></nav>`;
  },

  features(b) {
    const cols = Math.min(4, Math.max(2, parseInt(b.attrs.columns) || 3));
    const heading = b.attrs.title ? `<h2>${escapeHtml(b.attrs.title)}</h2>` : '';
    const cards = parseItems(b.body).map(i => `<div class="feature">
      ${i.icon ? `<div class="feature-icon">${escapeHtml(i.icon)}</div>` : ''}
      <h3>${escapeHtml(i.title || i.label || '')}</h3>
      ${i.body ? `<p>${inline(i.body)}</p>` : ''}
    </div>`).join('');
    return `<section class="block features">${heading}<div class="feature-grid" style="--cols:${cols}">${cards}</div></section>`;
  },

  stats(b) {
    const heading = b.attrs.title ? `<h2>${escapeHtml(b.attrs.title)}</h2>` : '';
    const cells = parseItems(b.body).map(i => `<div class="stat">
      <div class="stat-value">${escapeHtml(i.value || '')}</div>
      <div class="stat-label">${escapeHtml(i.label || '')}</div>
    </div>`).join('');
    return `<section class="block stats">${heading}<div class="stat-row">${cells}</div></section>`;
  },

  quote(b) {
    const who = [b.attrs.by, b.attrs.role].filter(Boolean).map(escapeHtml).join(' · ');
    return `<section class="block quote"><blockquote>${md(b.body)}</blockquote>${
      who ? `<p class="quote-by">${who}</p>` : ''}</section>`;
  },

  // Prices are the part of a page people scan hardest, so each tier is a card
  // and one may be marked featured. Features are semicolon-separated because a
  // nested list inside a list item is where this format would start fighting
  // the reader.
  pricing(b) {
    const heading = b.attrs.title ? `<h2>${escapeHtml(b.attrs.title)}</h2>` : '';
    const cards = parseItems(b.body).map(i => {
      const feats = String(i.features || '').split(';').map(f => f.trim()).filter(Boolean)
        .map(f => `<li>${inline(f)}</li>`).join('');
      const cta = i.cta
        ? `<p class="actions"><a class="btn ${i.featured === 'true' ? 'btn-primary' : 'btn-ghost'}" href="${escapeHtml(i.href || '#')}">${escapeHtml(i.cta)}</a></p>`
        : '';
      return `<div class="tier${i.featured === 'true' ? ' tier-featured' : ''}">
        <h3>${escapeHtml(i.name || '')}</h3>
        <p class="tier-price">${escapeHtml(i.price || '')}<span>${escapeHtml(i.period || '')}</span></p>
        ${i.body ? `<p class="tier-body">${inline(i.body)}</p>` : ''}
        ${feats ? `<ul class="tier-feats">${feats}</ul>` : ''}${cta}
      </div>`;
    }).join('');
    return `<section class="block pricing">${heading}<div class="tier-grid">${cards}</div></section>`;
  },

  // Plain <details> rather than scripted accordions: it opens without
  // JavaScript, it is searchable in the page, and screen readers already know
  // what it is.
  faq(b) {
    const heading = b.attrs.title ? `<h2>${escapeHtml(b.attrs.title)}</h2>` : '';
    const rows = parseItems(b.body).map(i => `<details>
      <summary>${escapeHtml(i.q || i.label || '')}</summary>
      <div class="faq-a">${md(i.a || '')}</div>
    </details>`).join('');
    return `<section class="block faq">${heading}<div class="faq-list">${rows}</div></section>`;
  },

  footer(b) {
    const links = parseItems(b.body).filter(i => i.label)
      .map(i => `<a href="${escapeHtml(i.href || '#')}">${escapeHtml(i.label)}</a>`).join('');
    return `<section class="block site-footer">
      <div class="footer-links">${links}</div>
      ${b.attrs.note ? `<p class="footer-note">${escapeHtml(b.attrs.note)}</p>` : ''}
    </section>`;
  },


  // A directory of every site the hotel serves. It is a directive rather than
  // a hardcoded page so a landing page opts in — a customer's site should not
  // list its neighbours just because it lives in the same container.
  sites(b, ctx = {}) {
    const all = store.list().filter(s => s.host !== 'default');
    const domains = store.configuredDomains();
    const hidden = new Set(String(b.attrs.hide || '').split(/[,\s]+/).filter(Boolean));
    const list = all.filter(s => !hidden.has(s.host));

    const heading = b.attrs.title ? `<h2>${escapeHtml(b.attrs.title)}</h2>` : '';
    const intro = b.body.trim() ? md(b.body) : '';

    if (!list.length) {
      return `<section class="block sites">${heading}${intro}<p class="note">No sites yet.</p></section>`;
    }

    const cards = list.map(s => {
      const live = store.isRouted(s.host, domains) !== false;
      // Only a signed-in admin is offered the destructive action, and the
      // form posts to the admin route, which checks the session again. The
      // button being hidden is a courtesy, not the control.
      const remove = ctx.isAdmin
        ? `<form method="post" action="/admin/delete" class="card-del"
             onsubmit="return confirm('Delete ${escapeHtml(s.host)}? The file is removed for good.')">
             <input type="hidden" name="host" value="${escapeHtml(s.host)}">
             <button type="submit" title="Delete this site">×</button>
           </form>`
        : '';
      const edit = ctx.isAdmin
        ? `<a class="card-edit" href="/admin/edit?host=${encodeURIComponent(s.host)}">Edit</a>`
        : '';
      const href = live ? `https://${s.host}/` : `#`;
      return `<article class="card">
        ${remove}
        <a class="card-link" href="${escapeHtml(href)}"${live ? '' : ' aria-disabled="true"'}>
          <h3>${escapeHtml(s.title || s.host)}</h3>
          <p class="card-host">${escapeHtml(s.host)}</p>
        </a>
        <p class="card-meta">${(s.bytes / 1024).toFixed(1)} kB · ${escapeHtml(s.updated.slice(0, 10))}${live ? '' : ' · not routed'}</p>
        ${edit}
      </article>`;
    }).join('');

    return `<section class="block sites">${heading}${intro}<div class="card-grid">${cards}</div></section>`;
  }
};

renderers['two-column'] = renderers.split;

function renderBlocks(blocks, ctx = {}) {
  return blocks.map(b => {
    const fn = renderers[b.type];
    // An unknown directive renders as text rather than vanishing. A typo in a
    // block name should cost you the layout, never the words.
    return fn ? fn(b, ctx) : renderers.text(b, ctx);
  }).join('\n');
}

module.exports = { parseFrontmatter, parseBlocks, renderBlocks, escapeHtml };
