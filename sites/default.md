---
title: "Markdown Hotel — every domain is a file"
description: "One application serves many domains. Each landing page is a single markdown file."
footer: "Served by markdown-hotel · view the source at /site.md"
---

::hero{eyebrow="pilot"}
# Every domain is **one file**.

## Point a hostname here, drop in a markdown file, and it is a website. No database, no build step, no dashboard — the source is the site.

[Read this page's source](/site.md){.primary} [See the blocks](#blocks){.ghost}
::

::two-column{image="https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&q=80" imageAlt="A desk with a notebook and coffee" eyebrow="how it works"}
## The Host header picks the site

A request for `acme.com` is served from `acme.com.md`. A request for
`something-else.com` is served from `something-else.com.md`. Same process,
same container, different file.

It is the hotel pattern applied to content: one building, many rooms, and
the doorplate is the domain name.
::

::text
## Blocks {#blocks}

Four directives, and anything outside them is ordinary markdown:

- `::hero` — the opening statement, with call-to-action links
- `::two-column` — text beside an image, `reverse=true` to flip it
- `::cta` — a boxed invitation, centred
- `::text` — everything else

A link written as `[Label](/where){.primary}` becomes a button. An unknown
directive still renders its words — a typo in a block name costs you the
layout, never the content.
::

::cta
## Ready to move in?

Give a hostname a file and it opens for business.

[Get started](/site.md){.primary}
::
