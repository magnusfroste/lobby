# Lobby

A hotel for landing pages. One process, many domains — each site is a single
markdown file.

```
acme.com       → sites/acme.com.md
otherbrand.io  → sites/otherbrand.io.md
```

The request's `Host` decides which file is the site, the same way a reverse
proxy picks a backend by hostname. There is no database: publishing is writing
a file, backing up is copying a folder, and the source a human edits is the
source an LLM reads.

## The format

Optional frontmatter, then blocks. Anything outside a block is ordinary
markdown, so a plain `.md` file renders fine with no directives at all.

```markdown
---
title: "Acme — industrial rope"
description: "Rope since 1904."
footer: "© Acme"
---

::hero{eyebrow="since 1904"}
# Rope that **holds**.
## Braided in Gothenburg, tested to failure, sold by the metre.

[See the catalogue](/site.md){.primary} [Call us](tel:+46000000){.ghost}
::

::two-column{image="https://example.com/rope.jpg" imageAlt="Coiled rope" reverse=true}
## Made to be trusted
Every batch is pull-tested and stamped.
::

::cta
## Need a quote?
[Email us](mailto:hi@example.com){.primary}
::
```

| Directive | What it is |
| --- | --- |
| `::hero` | The opening statement, with call-to-action links |
| `::two-column` | Text beside an image. `reverse=true` flips it. Alias: `::split` |
| `::cta` | A boxed invitation, centred |
| `::text` | Everything else |

A link written `[Label](/where){.primary}` becomes a button (`.primary`,
`.ghost`). An unknown directive still renders its words — a typo in a block
name costs you the layout, never the content.

`GET /site.md` serves the source verbatim. That is the point of the format,
not a debug hatch.

## Running it

```bash
npm install && npm start          # http://localhost:8080
docker build -t lobby . && docker run -p 8080:8080 lobby
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8080` | Port to listen on |
| `SITES_DIR` | `/sites` | Where the markdown files live |
| `DEFAULT_SITE` | `default` | File served when no hostname matches |
| `LOBBY_API_TOKEN` | *(unset)* | Bearer token for `/mcp`. Unset means the endpoint is off |
| `LOBBY_ADMIN_PASSWORD` | *(unset)* | Password for `/admin`. Unset means the admin is off |
| `LOBBY_ADMIN_USER` | `admin` | Admin username |
| `AGENTHOTEL_DOMAINS` | *(unset)* | Hostnames routed here, so the admin can show which sites are live |

## Themes

Set `theme:` in frontmatter. Each theme is a palette, a typeface pairing and
one signature detail you can recognise at a glance — without that, themes are
the same page in different colours and an agent picking one is guessing.

| Theme | Signature |
| --- | --- |
| `default` | None — the neutral baseline |
| `editorial` | Drop cap on the first paragraph after a heading |
| `brutalist` | Heavy rules above every block, no rounded corners |
| `warm` | Pill buttons and a tinted hero |
| `midnight` | Dark by default, glowing hairline under the hero |

## Admin

`/admin` is the human half of the same job: a list of every site, click one to
edit its markdown, save. Agents write over MCP, people click here, and both go
through the same store — an agent's change shows up in the editor immediately.

Set `LOBBY_ADMIN_PASSWORD` to turn it on. Signed in, every site also carries an
**Edit this page** button, so you can go from reading a page to fixing its
typo without finding it in a list.

The list marks a site **live** when a hostname is actually routed here, and
warns when a routed hostname has **no file** — a visitor gets the default site
and nothing looks broken, which makes it the hardest failure to notice. That
comparison is why the container is told its own domains.

Writes are atomic and versioned. When an agent saves a site while you have it
open, saving refuses with a conflict rather than silently discarding their
work; your text stays in the editor so you can decide.

## MCP — letting an agent run the hotel

`POST /mcp` speaks JSON-RPC 2.0 with a bearer token, the same shape as
AgentHotel's own endpoint. Five tools, because a site is a file:
`list_sites`, `read_site`, `write_site`, `delete_site`, `list_themes`.

```json
{
  "mcpServers": {
    "lobby": {
      "url": "https://lobby.example.com/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

Writing a site publishes it, so the endpoint stays closed until
`LOBBY_API_TOKEN` is set — a world-writable CMS is not a default anyone should
get by accident. `write_site` replaces the whole file rather than merging, so
read before you edit.

Files in the image's `/seed` are copied into `SITES_DIR` only when a name is
missing, so a redeploy never overwrites a site you have edited.

## Notes

- The hostname reaches the filesystem, so it is validated rather than trusted:
  lowercased, port stripped, restricted to what a domain may contain. A `Host`
  of `../../etc/passwd` gets the default site, not a file read.
- `www.example.com` falls back to `example.com.md`, so one file serves both.
- No client-side JavaScript. The page renders on arrival, which is what makes
  it readable by crawlers and language models.

## Credits

The `::directive{attr}` format follows
[markdownweb](https://github.com/magnusfroste/markdownweb), so content moves
between them.
