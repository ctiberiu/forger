/**
 * PackRadar's design tokens, extracted from the twelve cards in `examples/`.
 *
 * Every value here was measured from those JPEGs rather than copied from the brief — colours by
 * sampling glyph interiors, type sizes by measuring cap-height bands and dividing by Geist's
 * capHeight/unitsPerEm of 0.710 read from the TTF, geometry by locating tonal edges. Where the
 * brief and the artwork disagree, the artwork wins and the disagreement is noted at the token.
 *
 * These are pack tokens. `lib/engine/` never reads a colour, and none of this belongs in the
 * operator dashboard — signal green is the *posts'* colour, and PostForge is the generic engine.
 */

/** Canvas dimensions per rendition format. Every other measurement assumes a 1080-wide canvas. */
export const formats = {
  feed_1x1: { width: 1080, height: 1080 },
  feed_4x5: { width: 1080, height: 1350 },
  story_9x16: { width: 1080, height: 1920 },
} as const;

export type FormatKey = keyof typeof formats;

/**
 * Measured, not quoted. `design-brief.md` §6 and master plan §A both give the ground as `#0A0F14`,
 * a blue-black. Every flat card in `examples/` is `#060B07`, a green-black — 80.3% of `04-intel`,
 * 82.0% of `08-sellout-recap`. A JPEG round-trip control shifts a known colour by at most 3 per
 * channel, so the gap (blue 0x14 vs 0x07) is real and not compression. Raised for a ruling; the
 * artwork is used until one lands.
 */
const ground = '#060B07';

export const colour = {
  /** The near-black every card sits on. Green-tinted, not blue. */
  ground,
  /** Lifted ground for the CTA band and the outlined badge — measured `#0D1F12` on 02 and 10. */
  groundRaised: '#0D1F12',
  /** Panel fill behind a photo frame, and the ground of `11-ugc`. */
  groundPanel: '#080F08',
  /** Story ground: visibly greener than the feed ground. Measured on `09-story-poll`. */
  groundStory: '#0D2414',
  /** Fill inside a story option box, darker than the story ground it sits on. */
  groundStoryPanel: '#061109',

  /** Signal green. The accent: status labels, prices under emphasis, CTA text, live dots. */
  signal: '#2EE66B',
  /** Mint. Product names, headlines, prices at rest — the primary reading colour. */
  mint: '#C8F5DC',
  /**
   * Secondary text. Glyph plateaus range `#68766F`–`#96AA9F` across the twelve; small mono never
   * reaches a plateau, so the brief's value is kept as the midpoint of that spread.
   */
  muted: '#7C8C84',
  /** Hairline rules and frame strokes. Recurs at 0.4–0.8% across 04, 08 and 11. */
  rule: '#223029',
} as const;

/**
 * The full-green inversion, used by `03-carousel` and `12-weekly-report`.
 *
 * Note for anyone reconciling documents: the phase description names the inverted pair as `01`
 * and `12`. It is `03` and `12` — `01-launch` is a dark card with a radar glow. Master plan §A
 * and this sub-epic both say `03`.
 *
 * Expressed as a ground/ink swap so a layout reads `theme.ground` and `theme.ink` and never
 * branches on which variant it is in.
 */
export const themes = {
  dark: {
    ground: colour.ground,
    ink: colour.mint,
    inkMuted: colour.muted,
    accent: colour.signal,
    rule: colour.rule,
  },
  inverted: {
    ground: colour.signal,
    ink: '#041209',
    inkMuted: '#0A2B14',
    accent: '#041209',
    rule: '#0A2B14',
  },
} as const;

export type ThemeKey = keyof typeof themes;
export type Theme = (typeof themes)[ThemeKey];

/**
 * Geist Sans and Geist Mono, static weights only.
 *
 * Satori reads `ttf`, `otf` and `woff` — **not** `woff2`. The `geist` package ships both; the
 * `.ttf` files are the ones that can be embedded. The `[wght]` variable files must not be used:
 * Satori's variable-font support does not select an instance.
 */
export const font = {
  sans: 'Geist',
  mono: 'Geist Mono',
  /** Weights present as static TTFs and actually used by the twelve. */
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  /** capHeight ÷ unitsPerEm, read from every Geist TTF. Used to derive size from a measurement. */
  capHeightRatio: 0.71,
} as const;

/**
 * Type scale in px on a 1080 canvas, derived from measured cap-height bands.
 *
 * | token      | seen in                          | measured band | implied size |
 * |------------|----------------------------------|---------------|--------------|
 * | `micro`    | status labels, eyebrows          | 14px          | 20           |
 * | `small`    | badges, body copy                | 16–17px       | 22           |
 * | `label`    | CTA band                         | 19px          | 26           |
 * | `title`    | section headlines (`04`)         | 27px          | 38           |
 * | `headline` | card headlines (`08`)            | 38px          | 52           |
 * | `display`  | product name (`02`), poll (`09`) | 44px          | 60           |
 * | `hero`     | stat values (`12`)               | 62px          | 88           |
 * | `colossal` | `41 min` (`08`), price (`10`)    | 141px         | 196          |
 */
export const type = {
  micro: 20,
  small: 22,
  label: 26,
  title: 38,
  headline: 52,
  display: 60,
  hero: 88,
  colossal: 196,
} as const;

export type TypeStep = keyof typeof type;

/**
 * Line height as a multiplier. `display` is measured: the product name in `02-drop` sets three
 * lines on a 69px pitch at 60px, which is 1.15.
 */
export const leading = {
  tight: 1.05,
  display: 1.15,
  body: 1.4,
} as const;

/**
 * Mono caps in the twelve are conspicuously letterspaced — it is what makes a status label read
 * as instrumentation rather than as text. Expressed in em so it survives a size change.
 */
export const tracking = {
  none: '0em',
  label: '0.12em',
  wide: '0.18em',
} as const;

/** 4-based spacing scale. `48` and `72` are the two outer margins the twelve actually use. */
export const space = {
  x1: 4,
  x2: 8,
  x3: 12,
  x4: 16,
  x6: 24,
  x8: 32,
  x10: 40,
  x12: 48,
  x15: 60,
  x18: 72,
  x24: 96,
} as const;

/**
 * Structural geometry, measured on `02-drop` and `10-price-drop`.
 *
 * The hairline is **2px**, not 1: the rule under the status bar occupies rows 92–93, and the row
 * rules in `04-intel` occupy 336–337. A 1px line reads as a rendering error at this canvas size.
 */
export const rule = {
  hairline: 2,
} as const;

export const frame = {
  /** Stroke around a photo frame and around the whole card. */
  stroke: 2,
  /** Outer card border, inset from the canvas edge — transitions at x=1..3 on every card. */
  inset: 2,
} as const;

/** Bands that recur across the feed cards, in px on a 1080×1080 canvas. */
export const band = {
  /** Status bar: ground to the hairline at y=92. */
  statusHeight: 92,
  /** CTA band: y=970 to the bottom edge. */
  ctaHeight: 110,
  /** Outer content margin on `02-drop` (frame edge at x=45) and on `06-story-live` (x=60). */
  marginTight: 48,
  /** Outer content margin on `04-intel`, `08-sellout-recap` and `12-weekly-report` (x=70–72). */
  margin: 72,
} as const;

/**
 * The status dot that precedes a live label — `● SIGNAL DETECTED`, `● IN STOCK`. Hollow when the
 * state is negative (`○ SOLD OUT` in `04-intel`), which is a fill change and not a colour change.
 */
export const dot = {
  size: 10,
  gap: 14,
} as const;

export const tokens = {
  formats,
  colour,
  themes,
  font,
  type,
  leading,
  tracking,
  space,
  rule,
  frame,
  band,
  dot,
} as const;

export type Tokens = typeof tokens;
