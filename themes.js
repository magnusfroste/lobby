// A theme is a palette, a typeface pairing and one signature detail.
//
// The signature matters more than it sounds: without it every theme is the
// same page in different colours, and an agent choosing between them is
// guessing. With it, "editorial" means a drop cap and "brutalist" means hard
// edges and no radius — something you can describe in one sentence and
// recognise at a glance.

const THEMES = {
  default: {
    description: 'Clean sans-serif, indigo accent. Signature: none — the neutral baseline.',
    css: ''
  },

  editorial: {
    description: 'Serif headlines, generous measure, cream paper. Signature: drop cap on the first paragraph after a heading.',
    css: `
      --bg: #fbfaf7; --fg: #1c1a17; --muted: #6b645b; --line: #e6e0d6;
      --accent: #9a3412; --accent-fg: #fff8f2; --soft: #f4f0e8;
      --measure: 62ch;
    `,
    extra: `
      body { font-family: ui-serif, Georgia, "Times New Roman", serif; }
      h1, h2, h3 { font-weight: 500; letter-spacing: -0.015em; }
      .block.text > p:first-of-type::first-letter {
        float: left; font-size: 3.1em; line-height: .84; padding: .05em .08em 0 0;
        font-weight: 600; color: var(--accent);
      }
      @media (prefers-color-scheme: dark) {
        :root { --bg: #17150f; --fg: #ece6da; --muted: #a49a89; --line: #2f2a20;
                --accent: #f0a071; --accent-fg: #1a1209; --soft: #201c15; }
      }
    `
  },

  brutalist: {
    description: 'Monospace, black on white, hard borders, no rounded corners. Signature: heavy rules above every block.',
    css: `
      --bg: #ffffff; --fg: #000000; --muted: #444444; --line: #000000;
      --accent: #0000ee; --accent-fg: #ffffff; --soft: #f2f2f2;
    `,
    extra: `
      body { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      h1, h2, h3 { letter-spacing: -0.03em; text-transform: uppercase; }
      .block { border-top: 4px solid var(--line); border-bottom: 0; }
      .block:first-child { border-top: 0; }
      .btn, .cta-inner, img, pre, code { border-radius: 0; }
      .btn { border-width: 2px; }
      .cta-inner { border-width: 3px; }
      @media (prefers-color-scheme: dark) {
        :root { --bg: #000000; --fg: #ffffff; --muted: #aaaaaa; --line: #ffffff;
                --accent: #7ce3ff; --accent-fg: #000000; --soft: #111111; }
      }
    `
  },

  warm: {
    description: 'Soft terracotta and oat, rounded shapes, friendly. Signature: pill-shaped buttons and a tinted hero.',
    css: `
      --bg: #fffaf5; --fg: #2b1f18; --muted: #7a6659; --line: #efe1d4;
      --accent: #c2410c; --accent-fg: #fff7f1; --soft: #fdf0e4;
    `,
    extra: `
      .btn { border-radius: 999px; padding-inline: 1.6rem; }
      .hero { background: linear-gradient(180deg, var(--soft), transparent); border-radius: 22px; padding-inline: 1.5rem; }
      img, .cta-inner { border-radius: 22px; }
      @media (prefers-color-scheme: dark) {
        :root { --bg: #1a1310; --fg: #f3e6dc; --muted: #b39c8c; --line: #33241c;
                --accent: #fb923c; --accent-fg: #1a1006; --soft: #241811; }
      }
    `
  },

  midnight: {
    description: 'Dark by default, cyan accent, tight type. Signature: a glowing hairline under the hero.',
    css: `
      --bg: #0a0f16; --fg: #dfe7f0; --muted: #8ba0b8; --line: #1d2735;
      --accent: #22d3ee; --accent-fg: #04222a; --soft: #111a24;
    `,
    extra: `
      body { font-family: ui-sans-serif, system-ui, sans-serif; }
      h1, h2 { letter-spacing: -0.035em; }
      .hero { border-bottom: 1px solid var(--accent); box-shadow: 0 1px 24px -8px var(--accent); }
      .btn-primary { box-shadow: 0 0 24px -6px var(--accent); }
      /* Dark-first: the light override is the exception, not the default. */
      @media (prefers-color-scheme: light) {
        :root { --bg: #f4f8fb; --fg: #0d1620; --muted: #4a6076; --line: #d9e3ed;
                --accent: #0e7490; --accent-fg: #ffffff; --soft: #e8eff6; }
      }
    `
  }
};

function themeCss(name) {
  const theme = THEMES[name] || THEMES.default;
  const vars = theme.css ? `:root {${theme.css}}` : '';
  return `${vars}\n${theme.extra || ''}`;
}

function listThemes() {
  return Object.entries(THEMES).map(([name, t]) => ({ name, description: t.description }));
}

module.exports = { THEMES, themeCss, listThemes };
