import { writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { tokens } from '../packs/packradar/tokens.ts';

/**
 * Emits a contact sheet for PackRadar's tokens: every colour, type step, space, rule and band
 * rendered next to the cards in `examples/` they were measured from, so drift is visible without
 * opening a design tool.
 *
 * A composition root — it is the only thing that knows both the pack's tokens and where the
 * repository keeps its artwork. It renders as plain HTML rather than through Satori because the
 * point is to check the *values*, not the renderer; the renderer gets checked when a layout does.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

const EXAMPLES = [
  ['01-launch', 'dark ground, radar glow'],
  ['02-drop', 'the P1 target — status bar, photo frame, CTA band'],
  ['03-carousel', 'inverted'],
  ['04-intel', 'row rules, mono price column'],
  ['05-meme', 'backlog — screenshot card'],
  ['06-story-live', '9:16, card panels'],
  ['07-reel-cover', 'backlog — 9:16 glow'],
  ['08-sellout-recap', 'colossal stat, no imagery'],
  ['09-story-poll', 'story ground, option boxes'],
  ['10-price-drop', 'no imagery, raised badge'],
  ['11-ugc', 'panel ground, photo frame'],
  ['12-weekly-report', 'inverted, stat rows'],
] as const;

const escape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function swatch(name: string, value: string, note: string): string {
  return `<div class="swatch">
    <div class="chip" style="background:${value}"></div>
    <div class="meta"><code>${escape(name)}</code><b>${value}</b><span>${escape(note)}</span></div>
  </div>`;
}

function typeRow(step: string, size: number): string {
  const cap = Math.round(size * tokens.font.capHeightRatio);
  return `<tr>
    <td><code>type.${step}</code></td>
    <td class="num">${size}px</td>
    <td class="num">${cap}px cap</td>
    <td><div style="font-family:Geist,sans-serif;font-weight:700;font-size:${size}px;line-height:1.05;color:${tokens.colour.mint}">899 lei</div></td>
    <td><div style="font-family:'Geist Mono',monospace;font-size:${size}px;line-height:1.05;color:${tokens.colour.signal}">899</div></td>
  </tr>`;
}

const colourNotes: Record<string, string> = {
  ground: 'measured #060B07 — brief says #0A0F14, see tokens.ts',
  groundRaised: 'CTA band on 02, badge on 10',
  groundPanel: 'photo frame fill; ground of 11',
  groundStory: '09 story ground',
  groundStoryPanel: '09 option box',
  signal: 'accent — status, CTA, live dot',
  mint: 'primary reading colour',
  muted: 'secondary; plateaus span #68766F–#96AA9F',
  rule: 'hairlines and frame strokes',
};

const html = `<meta charset="utf-8">
<title>PackRadar tokens — contact sheet</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; padding:48px; background:#08110C; color:${tokens.colour.mint};
         font-family:Geist,system-ui,sans-serif; }
  h1 { font-size:28px; margin:0 0 4px; letter-spacing:-0.01em; }
  h2 { font-size:13px; letter-spacing:0.18em; text-transform:uppercase;
       color:${tokens.colour.signal}; margin:56px 0 16px;
       border-bottom:2px solid ${tokens.colour.rule}; padding-bottom:10px; }
  p.lede { color:${tokens.colour.muted}; margin:0 0 8px; max-width:70ch; line-height:1.5; }
  code { font-family:'Geist Mono',ui-monospace,monospace; font-size:12px; color:${tokens.colour.signal}; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:14px; }
  .swatch { display:flex; gap:12px; align-items:center; background:#0B1510;
            border:2px solid ${tokens.colour.rule}; border-radius:6px; padding:10px; }
  .chip { width:52px; height:52px; border-radius:4px; flex:none;
          box-shadow:inset 0 0 0 1px rgba(255,255,255,.10); }
  .meta { display:flex; flex-direction:column; gap:2px; min-width:0; }
  .meta b { font-family:'Geist Mono',monospace; font-size:12px; font-weight:500; }
  .meta span { font-size:11px; color:${tokens.colour.muted}; line-height:1.35; }
  table { border-collapse:collapse; width:100%; }
  td, th { border-bottom:2px solid ${tokens.colour.rule}; padding:12px 10px; text-align:left;
           vertical-align:middle; }
  th { font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:${tokens.colour.muted}; }
  .num { font-family:'Geist Mono',monospace; font-size:12px; color:${tokens.colour.muted}; white-space:nowrap; }
  .bars { display:flex; flex-direction:column; gap:8px; }
  .bar { display:flex; align-items:center; gap:12px; }
  .bar i { display:block; height:14px; background:${tokens.colour.signal}; border-radius:2px; }
  .cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:18px; }
  .card figcaption { font-size:11px; color:${tokens.colour.muted}; margin-top:8px; line-height:1.4; }
  .card img { width:100%; display:block; border:2px solid ${tokens.colour.rule}; border-radius:4px; }
  .card code { display:block; margin-top:6px; }
  .demo { border:2px solid ${tokens.colour.rule}; border-radius:6px; overflow:hidden; max-width:420px; }
  .demo .status { height:${tokens.band.statusHeight / 2}px; display:flex; align-items:center;
        justify-content:space-between; padding:0 ${tokens.band.marginTight / 2}px;
        border-bottom:${tokens.rule.hairline}px solid ${tokens.colour.rule};
        font-family:'Geist Mono',monospace; font-size:11px; letter-spacing:${tokens.tracking.label};
        color:${tokens.colour.signal}; }
  .demo .body { padding:24px ${tokens.band.marginTight / 2}px; min-height:120px; }
  .demo .cta { height:${tokens.band.ctaHeight / 2}px; display:flex; align-items:center;
        justify-content:center; background:${tokens.colour.groundRaised};
        font-family:'Geist Mono',monospace; font-size:12px; letter-spacing:${tokens.tracking.label};
        color:${tokens.colour.signal}; }
  .theme { padding:20px; border-radius:6px; }
</style>

<h1>PackRadar — token contact sheet</h1>
<p class="lede">Generated from <code>packs/packradar/tokens.ts</code>. Every value was measured from
the twelve cards below rather than copied from the brief. If a swatch stops matching its card,
the token drifted.</p>

<h2>Colour</h2>
<div class="grid">
${Object.entries(tokens.colour)
  .map(([name, value]) => swatch(`colour.${name}`, value, colourNotes[name] ?? ''))
  .join('\n')}
</div>

<h2>Themes — the inversion is a swap, not a branch</h2>
<div class="grid">
${Object.entries(tokens.themes)
  .map(
    ([name, theme]) => `<div class="theme" style="background:${theme.ground};color:${theme.ink};
      border:2px solid ${theme.rule}">
      <div style="font-size:22px;font-weight:700">${escape(name)}</div>
      <div style="font-family:'Geist Mono',monospace;font-size:12px;color:${theme.inkMuted};margin-top:6px">
        ground ${theme.ground} · ink ${theme.ink}</div>
      <div style="font-family:'Geist Mono',monospace;font-size:12px;color:${theme.accent};
        letter-spacing:${tokens.tracking.label};margin-top:10px">● SIGNAL DETECTED</div>
    </div>`,
  )
  .join('\n')}
</div>

<h2>Type scale — size, implied cap-height, both faces</h2>
<table>
  <tr><th>token</th><th>size</th><th>cap</th><th>Geist Sans 700</th><th>Geist Mono 400</th></tr>
  ${Object.entries(tokens.type)
    .map(([step, size]) => typeRow(step, size))
    .join('\n')}
</table>

<h2>Leading and tracking</h2>
<table>
  <tr><th>token</th><th>value</th><th>specimen</th></tr>
  ${Object.entries(tokens.leading)
    .map(
      ([name, value]) => `<tr><td><code>leading.${name}</code></td><td class="num">${value}</td>
      <td style="font-size:20px;line-height:${value};max-width:52ch">Last restock sold out in 41 min.
      The next one will not wait for you either.</td></tr>`,
    )
    .join('\n')}
  ${Object.entries(tokens.tracking)
    .map(
      ([name, value]) => `<tr><td><code>tracking.${name}</code></td><td class="num">${value}</td>
      <td style="font-family:'Geist Mono',monospace;font-size:16px;letter-spacing:${value};
      color:${tokens.colour.signal}">SIGNAL DETECTED</td></tr>`,
    )
    .join('\n')}
</table>

<h2>Spacing</h2>
<div class="bars">
${Object.entries(tokens.space)
  .map(
    ([name, value]) =>
      `<div class="bar"><code style="width:80px">space.${name}</code>
       <span class="num" style="width:52px">${value}px</span><i style="width:${value}px"></i></div>`,
  )
  .join('\n')}
</div>

<h2>Rules, frames, bands and the status dot</h2>
<table>
  <tr><th>token</th><th>value</th><th>note</th></tr>
  <tr><td><code>rule.hairline</code></td><td class="num">${tokens.rule.hairline}px</td>
      <td>rows 92–93 under the status bar; 336–337 between rows in 04</td></tr>
  <tr><td><code>frame.stroke</code></td><td class="num">${tokens.frame.stroke}px</td>
      <td>photo frame and card border</td></tr>
  <tr><td><code>frame.inset</code></td><td class="num">${tokens.frame.inset}px</td>
      <td>card border inset from the canvas edge</td></tr>
  <tr><td><code>band.statusHeight</code></td><td class="num">${tokens.band.statusHeight}px</td>
      <td>ground to the hairline</td></tr>
  <tr><td><code>band.ctaHeight</code></td><td class="num">${tokens.band.ctaHeight}px</td>
      <td>y=970 to the bottom edge</td></tr>
  <tr><td><code>band.marginTight</code></td><td class="num">${tokens.band.marginTight}px</td>
      <td>02-drop, 06-story-live</td></tr>
  <tr><td><code>band.margin</code></td><td class="num">${tokens.band.margin}px</td>
      <td>04-intel, 08-sellout-recap, 12-weekly-report</td></tr>
  <tr><td><code>dot.size</code> / <code>dot.gap</code></td>
      <td class="num">${tokens.dot.size}px / ${tokens.dot.gap}px</td>
      <td>filled when live, hollow when closed — a fill change, never a colour change</td></tr>
</table>

<p class="lede" style="margin-top:20px">Bands assembled at half scale, so the proportions of
<code>02-drop</code> can be checked against the card below:</p>
<div class="demo" style="background:${tokens.colour.ground}">
  <div class="status"><span>● SIGNAL DETECTED</span>
    <span style="color:${tokens.colour.muted}">SWEEP 09:41 · RO</span></div>
  <div class="body">
    <div style="font-family:'Geist Mono',monospace;font-size:11px;letter-spacing:${tokens.tracking.label};color:${tokens.colour.muted}">CARDMARKET.RO · JUST NOW</div>
    <div style="font-size:30px;font-weight:700;line-height:${tokens.leading.display};margin-top:12px">Prismatic Evolutions Booster Box</div>
  </div>
  <div class="cta">SEE LIVE STOCK → PACKRADAR.APP</div>
</div>

<h2>Formats</h2>
<table>
  <tr><th>format</th><th>dimensions</th></tr>
  ${Object.entries(tokens.formats)
    .map(
      ([name, size]) =>
        `<tr><td><code>${name}</code></td><td class="num">${size.width} × ${size.height}</td></tr>`,
    )
    .join('\n')}
</table>

<h2>The twelve, as measured</h2>
<div class="cards">
${EXAMPLES.map(
  ([name, note]) => `<figure class="card" style="margin:0">
    <img src="${relative(repoRoot, join(repoRoot, 'examples', `${name}.jpg`))}" alt="${name}" loading="lazy">
    <code>${name}</code><figcaption>${escape(note)}</figcaption></figure>`,
).join('\n')}
</div>
`;

const target = process.argv[2] ?? join(repoRoot, 'packs', 'packradar', 'contact-sheet.html');
writeFileSync(target, html, 'utf8');
console.log(`Contact sheet written to ${relative(repoRoot, target)} — open it beside examples/.`);
