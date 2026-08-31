// MCP so an agent can run the hotel.
//
// Same shape as AgentHotel's own endpoint: JSON-RPC 2.0 over HTTP with a
// bearer token. The tools are deliberately few, because a site is a file —
// list them, read one, write one, delete one. Anything more elaborate would be
// inventing an API on top of a filesystem that already has one.
//
// Writing a site is publishing it, so the endpoint is off unless a token is
// set. A world-writable CMS is not a default anyone should get by accident.

const { listThemes } = require('./themes');
const store = require('./store');

const PROTOCOL = '2024-11-05';

const TOOLS = {
  list_sites: {
    description: 'List every site this hotel serves. Each entry is a hostname and the markdown file behind it',
    inputSchema: { type: 'object', properties: {} }
  },
  read_site: {
    description: "Read a site's markdown source, exactly as it is on disk",
    inputSchema: {
      type: 'object',
      properties: { host: { type: 'string', description: 'Hostname, e.g. acme.com' } },
      required: ['host']
    }
  },
  write_site: {
    description: 'Create or replace a site. The content is the whole file including frontmatter — this overwrites, it does not merge. Read it first if you mean to edit',
    inputSchema: {
      type: 'object',
      properties: {
        host: { type: 'string', description: 'Hostname, e.g. acme.com' },
        content: { type: 'string', description: 'The complete markdown source' },
        if_version: { type: 'string', description: "Optional. The version from read_site — the write is refused if someone else saved in the meantime, instead of quietly overwriting them" }
      },
      required: ['host', 'content']
    }
  },
  delete_site: {
    description: 'Delete a site. The hostname keeps resolving until its route is removed too, so it will fall back to the default site',
    inputSchema: {
      type: 'object',
      properties: { host: { type: 'string' } },
      required: ['host']
    }
  },
  list_themes: {
    description: 'List the themes a site may set in frontmatter as `theme: name`. Each has a one-line signature describing what makes it recognisable',
    inputSchema: { type: 'object', properties: {} }
  }
};

// The host becomes a filename, so it is validated rather than trusted — the
// same rule the request path uses, for the same reason.
function safeHost(host) {
  const bare = String(host || '').toLowerCase().trim().replace(/\.$/, '');
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(bare)) return null;
  if (bare.includes('..') || bare.length > 253) return null;
  return bare;
}

function ok(result) { return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }; }
function fail(message) { return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true }; }

function callTool(name, args) {
  switch (name) {
    case 'list_sites':
      return ok({ sites: store.list(), domains: store.configuredDomains() });

    case 'read_site': {
      const site = store.read(args.host);
      if (!site) return fail(`No site for ${args.host}`);
      // The version comes back so a careful writer can pass it to write_site
      // and be told about a clash instead of quietly winning one.
      return ok(site);
    }

    case 'write_site': {
      const result = store.write(args.host, args.content, args.if_version);
      return ok({
        ...result,
        note: result.created ? 'Created — point the hostname at this hotel to serve it' : 'Replaced'
      });
    }

    case 'delete_site':
      return store.remove(args.host)
        ? ok({ host: args.host, deleted: true })
        : fail(`No site for ${args.host}`);

    case 'list_themes':
      return ok({ themes: listThemes() });

    default:
      return fail(`Unknown tool: ${name}`);
  }
}

function handle(req, res, body, { sitesDir, token }) {
  if (!token) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'MCP is disabled — set LOBBY_API_TOKEN to enable it' }));
  }

  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (auth !== token) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }

  let rpc;
  try { rpc = JSON.parse(body || '{}'); }
  catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
  }

  const reply = (result) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id ?? null, result }));
  };

  try {
    switch (rpc.method) {
      case 'initialize':
        return reply({
          protocolVersion: PROTOCOL,
          capabilities: { tools: {} },
          serverInfo: { name: 'lobby', version: '0.2.0' }
        });
      case 'tools/list':
        return reply({ tools: Object.entries(TOOLS).map(([name, t]) => ({ name, ...t })) });
      case 'tools/call':
        try {
          return reply(callTool(rpc.params?.name, rpc.params?.arguments || {}));
        } catch (err) {
          // A stale write is a normal outcome an agent should handle, not a
          // server fault — say which version is current so it can re-read.
          return reply(fail(err.conflict ? `${err.message} (current version ${err.currentVersion})` : err.message));
        }
      case 'notifications/initialized':
        return reply({});
      default:
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          jsonrpc: '2.0', id: rpc.id ?? null,
          error: { code: -32601, message: `Unknown method: ${rpc.method}` }
        }));
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id ?? null, error: { code: -32603, message: err.message } }));
  }
}

module.exports = { handle, TOOLS };
