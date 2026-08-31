// One stylesheet, inlined into every page. No build step, no external request,
// nothing to cache-bust — the page is one document that renders on arrival.
module.exports = `
:root {
  --bg: #ffffff; --fg: #16181d; --muted: #5b6472; --line: #e5e8ee;
  --accent: #4f46e5; --accent-fg: #ffffff; --soft: #f6f7fb;
  --measure: 68ch; --wide: 1080px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0e1014; --fg: #e8eaef; --muted: #9aa4b2; --line: #262b34;
    --accent: #8b87ff; --accent-fg: #14121f; --soft: #171b22;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0; background: var(--bg); color: var(--fg);
  font: 17px/1.65 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
main { max-width: var(--wide); margin: 0 auto; padding: 0 1.25rem; }
.block { padding: 3.5rem 0; border-bottom: 1px solid var(--line); }
.block:last-child { border-bottom: 0; }
h1, h2, h3 { line-height: 1.15; letter-spacing: -0.02em; margin: 0 0 .6em; }
h1 { font-size: clamp(2.1rem, 5.5vw, 3.6rem); }
h2 { font-size: clamp(1.5rem, 3vw, 2.1rem); }
p, ul, ol { max-width: var(--measure); }
p { margin: 0 0 1.1em; }
a { color: var(--accent); }
img { max-width: 100%; height: auto; display: block; border-radius: 12px; }
code { background: var(--soft); padding: .15em .4em; border-radius: 5px; font-size: .9em; }
pre { background: var(--soft); padding: 1rem; border-radius: 10px; overflow-x: auto; }
pre code { background: none; padding: 0; }
blockquote { margin: 0 0 1.1em; padding-left: 1rem; border-left: 3px solid var(--line); color: var(--muted); }

.eyebrow {
  text-transform: uppercase; letter-spacing: .12em; font-size: .74rem;
  font-weight: 600; color: var(--muted); margin: 0 0 1rem;
}
.hero { padding: 5rem 0 4rem; }
.hero h2 { font-size: clamp(1.05rem, 2.2vw, 1.35rem); font-weight: 400; color: var(--muted); letter-spacing: 0; }

.split { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center; }
.split-reverse .split-text { order: 2; }
@media (max-width: 760px) { .split { grid-template-columns: 1fr; gap: 2rem; } .split-reverse .split-text { order: 0; } }

.cta { text-align: center; }
.cta-inner { background: var(--soft); border: 1px solid var(--line); border-radius: 18px; padding: 3rem 1.5rem; }
.cta p, .cta h2 { margin-left: auto; margin-right: auto; }

.actions { display: flex; flex-wrap: wrap; gap: .75rem; margin: 1.6rem 0 0; }
.cta .actions { justify-content: center; }
.btn {
  display: inline-block; padding: .7rem 1.3rem; border-radius: 10px;
  text-decoration: none; font-weight: 600; font-size: .95rem;
  border: 1px solid var(--accent);
}
.btn-primary { background: var(--accent); color: var(--accent-fg); }
.btn-ghost, .btn-secondary { background: transparent; color: var(--accent); }
.btn:hover { opacity: .88; }

.card-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 1rem; margin-top: 1.75rem;
}
.card {
  position: relative; border: 1px solid var(--line); border-radius: 14px;
  padding: 1.15rem 1.2rem 1rem; background: var(--soft);
  display: flex; flex-direction: column; gap: .2rem;
}
.card-link { text-decoration: none; color: inherit; }
.card-link[aria-disabled="true"] { pointer-events: none; opacity: .65; }
.card h3 { font-size: 1.02rem; margin: 0 0 .2rem; letter-spacing: -.01em; }
.card-host { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: .8rem; color: var(--accent); margin: 0 0 .5rem; max-width: none; }
.card-meta { font-size: .76rem; color: var(--muted); margin: auto 0 0; max-width: none; }
.card-edit { font-size: .78rem; margin-top: .55rem; font-weight: 600; }
.card-del { position: absolute; top: .5rem; right: .55rem; margin: 0; }
.card-del button {
  background: transparent; border: 1px solid var(--line); color: var(--muted);
  width: 26px; height: 26px; border-radius: 8px; cursor: pointer; line-height: 1; font-size: 1rem;
}
.card-del button:hover { border-color: #ef4444; color: #ef4444; }
.note { color: var(--muted); }

footer { max-width: var(--wide); margin: 0 auto; padding: 2.5rem 1.25rem 4rem; color: var(--muted); font-size: .85rem; }
`;
