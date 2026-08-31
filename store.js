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
  return String(raw).split(/[,\s]+/).map(h => safeHost(h)).filter(Boolean);
}

module.exports = { list, read, write, remove, safeHost, versionOf, sitesDir, configuredDomains };
