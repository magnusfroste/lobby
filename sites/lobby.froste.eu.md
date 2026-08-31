---
title: "Lobby — every domain is one file"
description: "One process serves many domains. Each landing page is a single markdown file: no database, no build step, no dashboard."
theme: brutalist
footer: "Lobby · running on AgentHotel · source at /site.md"
---

::hero{eyebrow="running on agenthotel"}
# Every domain is **one file**.

## Point a hostname at this container, drop in a markdown file, and it is a website. The text you edit is the text a language model reads.

[Read this page's source](/site.md){.primary} [See the other guest](https://kund.froste.eu){.ghost}
::

::two-column{eyebrow="the whole trick" image="https://images.unsplash.com/photo-1481277542470-605612bd2d61?w=1200&q=80" imageAlt="A hotel corridor with numbered doors"}
## The doorplate is the domain

This page and the one at **kund.froste.eu** are served by the same process,
the same port and the same container. The only thing that differs is the
`Host` header on the request.

`lobby.froste.eu` is `sites/lobby.froste.eu.md`. That is the entire routing
rule, and it is the same rule the hotel already uses to find a guest.
::

::text
## Four blocks

`::hero` opens. `::two-column` puts text beside an image. `::cta` boxes an
invitation. `::text` is everything else — and anything outside a block is
ordinary markdown, so a plain file renders fine with no directives at all.

A link written `[Label](/where){.primary}` becomes a button. An unknown
directive still renders its words: a typo in a block name costs you the
layout, never the content.
::

::sites{title="Guests currently checked in" hide="example.local"}
Every site below is a markdown file in this same container. Signed in as admin,
each card can be edited or removed from here.
::

::cta
## Want a room?

Give a hostname a file and it opens for business.

[github.com/magnusfroste/lobby](https://github.com/magnusfroste/lobby){.primary}
::
