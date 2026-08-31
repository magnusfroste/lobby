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
