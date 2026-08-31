// Sites are files. This is the whole storage layer.
//
// A database would buy transactions, indexes and concurrent writes. A web
// hotel with a hundred landing pages needs none of those, and paying for them
// costs the thing that makes the format worth using: the source you edit with
// any tool, version with git, back up with cp, and hand to a language model
// verbatim.
//
// The one real risk files have is two writers clobbering each other, and that
// is solved here rather than by moving to a database: writes are atomic, and a
// caller may pass the version it read to be told when it has gone stale.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sitesDir() {
  return process.env.SITES_DIR || path.join(__dirname, 'sites');
}

// A hostname becomes a filename, so it is validated rather than trusted.
function safeHost(host) {
  const bare = String(host || '').toLowerCase().trim().replace(/\.$/, '');
  if (!bare || bare.length > 253) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(bare)) return null;
  if (bare.includes('..')) return null;
  return bare;
}

function fileFor(host) {
  return path.join(sitesDir(), `${host}.md`);
}

// The version is a hash of the content, not a timestamp: two writes in the
// same second are common when an agent is working, and mtime cannot tell them
// apart.
function versionOf(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
}

function list() {
  const dir = sitesDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      return {
        host: f.slice(0, -3),
        bytes: st.size,
        updated: st.mtime.toISOString(),
        title: titleOf(fs.readFileSync(full, 'utf8'))
      };
    })
    .sort((a, b) => a.host.localeCompare(b.host));
}

function titleOf(content) {
  const m = /^\s*title:\s*(.+)$/m.exec(content.slice(0, 800));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

function read(host) {
  const safe = safeHost(host);
  if (!safe) throw new Error('Invalid host');
  const file = fileFor(safe);
  if (!fs.existsSync(file)) return null;
  const content = fs.readFileSync(file, 'utf8');
  return { host: safe, content, version: versionOf(content) };
}

// ifVersion is optional. When given and stale, the write is refused rather
// than silently overwriting whatever the other writer just saved.
function write(host, content, ifVersion) {
  const safe = safeHost(host);
  if (!safe) throw new Error('Invalid host');
  if (typeof content !== 'string' || !content.trim()) throw new Error('Content must be a non-empty string');

  const file = fileFor(safe);
  const existed = fs.existsSync(file);
  if (ifVersion && existed) {
    const current = versionOf(fs.readFileSync(file, 'utf8'));
    if (current !== ifVersion) {
      const err = new Error('This site changed since you read it');
      err.conflict = true;
      err.currentVersion = current;
      throw err;
    }
  }

  fs.mkdirSync(sitesDir(), { recursive: true });
  // Write beside the target and rename. A reader never sees half a file, and a
  // crash mid-write leaves the previous version intact.
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
  return { host: safe, created: !existed, bytes: Buffer.byteLength(content), version: versionOf(content) };
}

function remove(host) {
  const safe = safeHost(host);
  if (!safe) throw new Error('Invalid host');
  const file = fileFor(safe);
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
}

// The hostnames the hotel actually answers to, as told by whoever deployed it.
// A site file with no domain is invisible; a domain with no file falls back to
// the default site. Both are worth seeing side by side, and neither is
// knowable from inside the container without being told.
function configuredDomains() {
  const raw = process.env.AGENTHOTEL_DOMAINS || process.env.LOBBY_DOMAINS || '';
  return String(raw).split(/[,\s]+/).map(entry => {
    // Wildcards belong in this list — they are how a hotel serves a site with
    // no configuration at all. safeHost rejects the asterisk because a
    // hostname must never become one, so the prefix is checked separately and
    // put back rather than validated away.
    const value = String(entry || '').trim().toLowerCase();
    if (value.startsWith('*.')) {
      const rest = safeHost(value.slice(2));
      return rest ? `*.${rest}` : null;
    }
    return safeHost(value);
  }).filter(Boolean);
}

// Is this site actually reachable? A hostname may be routed here by name, or
// swept up by a wildcard — which is the normal case once a hotel is set up,
// since a wildcard is what removes the per-site configuration step. Comparing
// names exactly marked every wildcard-served site as unrouted, which is the
// opposite of the truth and exactly the reassurance the list exists to give.
function isRouted(host, domains = configuredDomains()) {
  if (!domains.length) return null;            // nothing to compare against
  if (domains.includes(host)) return true;
  return domains.some(d => {
    if (!d.startsWith('*.')) return false;
    const suffix = d.slice(1);                 // "*.example.com" -> ".example.com"
    if (!host.endsWith(suffix)) return false;
    // A wildcard covers one label: *.example.com matches a.example.com but
    // not a.b.example.com, which is how Caddy and Cloudflare read it too.
    return !host.slice(0, host.length - suffix.length).includes('.');
  });
}

// The catch-all is opt-in, so a file is only the fallback when it is named as
// one. Labelling default.md "fallback" after DEFAULT_SITE was turned off told
// the operator a file was serving traffic that nothing could reach.
function fallbackSite() {
  return process.env.DEFAULT_SITE || '';
}

module.exports = { list, read, write, remove, safeHost, versionOf, sitesDir, configuredDomains, isRouted, fallbackSite };
