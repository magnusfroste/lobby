---
title: "Second site, same container"
description: "Proof that the Host header, and nothing else, decides what you see."
footer: "This is example.local.md"
---

::hero{eyebrow="a different guest"}
# You asked for a **different domain**.

## So you got a different file. The process, the port and the container are identical — only the hostname changed.

[View this file](/site.md){.primary}
::

::text
Nothing here is shared with the other site except the renderer itself.
Change this file and only this domain changes.
::
