---
title: "Kund AB — same container, different building"
description: "A second site proving the Host header, and nothing else, decides what a visitor sees."
footer: "Kund AB · this is kund.froste.eu.md"
---

::hero{eyebrow="a different guest"}
# You asked for a **different domain**.

## So you got a different file. Same process, same port, same container — the hostname is the only thing that changed.

[View this file](/site.md){.primary} [Back to Lobby](https://lobby.froste.eu){.ghost}
::

::two-column{reverse=true image="https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80" imageAlt="An empty office" eyebrow="independence"}
## Nothing is shared but the renderer

Change this file and only this domain changes. There is no shared theme to
break, no build to rerun, no cache to clear — the next request reads the file
again.

Add a third domain and you add a third file. That is the whole scaling story.
::

::cta
## This is what a customer site looks like

One file, four blocks, ten minutes.

[See the source](/site.md){.primary}
::
