# Closing Bell, design notes

The page should read like a closing-bell ceremony on a meme-stock floor: GME black, Robinhood green, hat-band red, polished gold. Institutional energy, not broker-terminal beige.

## Color

All tokens live in the `@theme` block of `app/globals.css`. Palette is derived from the Bellwether podium logo plus the GME pair.

### Floor, the surface scale

Cool charcoal / GME black, not warm beige-on-black.

| Token | Hex | Use |
| --- | --- | --- |
| `floor-1000` | `#050505` | Deepest well, digit cell bottoms |
| `floor-950` | `#0b0b0b` | Page background |
| `floor-900` | `#121212` | Panels, cards, board faces |
| `floor-850` | `#181818` | Digit cell top half |
| `floor-800` | `#1f1f1f` | Inset tracks |
| `floor-700` | `#2a2a2a` | Raised control faces |
| `floor-600` | `#3d3d3d` | Highest surface |

`line` (`#262626`) and `line-strong` (`#3a3a3a`) are the only border colors.

`marble` (`#f4f1ea`) is a sheen token for panel inner highlights, not a page fill.

### Brass, the accent

Polished bell gold, richer than the old terminal brass.

`brass-50 #fff8e8` · `100 #ffe9b0` · `200 #f5d56a` · `300 #e8b84a` · `400 #d4a017` · `500 #c49212` · `600 #9a7010` · `700 #6e4e0c` · `800 #3d2a08`

Primary CTAs, jackpot numerals, and the `brass-text` lockup on "BELL".

### Ember, GME red

`ember-300 #ff6b73` · `400 #e31c23` · `500 #ce1126` · `600 #9b0d1c`

Hat-band red. Ring control, next-to-ring, winner flash. Never a wash.

### Tape, Robinhood green

`tape #00C805` · `tape-dim #007a03` · `tape-deep #0a7a32` (hat emerald).

LIVE pips, nav/link hover, focus rings, social hover, How it Works arrows. Not a halo around Bellwether.

### Ink

`ink #f7f7f5` · `ink-2 #c4c4be` · `ink-3 #8d8d88`. Cooler off-white so it holds on charcoal and on the hero video scrim.

### Measured contrast

Every text token, against the two surfaces text actually lands on. Small text needs 4.5:1, text at 24px or 18.66px bold needs 3:1.

| Token | on `floor-950` | on `floor-900` |
| --- | --- | --- |
| `ink` | 17.76 | 16.88 |
| `ink-2` | 8.70 | 8.27 |
| `ink-3` | 4.96 | 4.72 |
| `brass-200` | 13.63 | 12.95 |
| `brass-300` | 10.79 | 10.26 |
| `brass-400` | 7.97 | 7.58 |
| `brass-500` | 5.57 | 5.30 |
| `brass-600` (large only) | 3.65 | 3.47 |
| `ember-300` | 8.61 | 8.18 |
| `ember-500` | 5.95 | 5.65 |
| `tape` | 10.02 | 9.52 |

## Typography

Two families, both variable, both loaded through `next/font/google` so there is no runtime request and no layout shift.

**Archivo** for display and body. The width axis is what earns it a place here: at `font-stretch: 115%` the headline weight gets the wide, planted, signage feel of exchange lettering, and at 100% the same family handles body copy without a second download. `--font-display` and `--font-sans` both point at it.

**IBM Plex Mono** for every number that needs to hold a column and every label that needs to read as instrumentation. Tickers, timestamps, addresses, eyebrows, unit suffixes, the tape.

Deliberately not Inter, not Roboto, not a system stack.

### Scale

Display sizes are fluid via `clamp`, so there is one type ramp instead of a mobile set and a desktop set.

| Role | Size | Tracking | Leading |
| --- | --- | --- | --- |
| Hero lockup | `clamp(3.4rem, 12vw, 6.6rem)` | `-0.03em` | `0.84` |
| Bell Pot numeral | `clamp(3.2rem, 10.5vw, 7rem)` | `-0.03em` | `0.8` |
| After Hours pot | `clamp(2.6rem, 7vw, 4.6rem)` | `-0.02em` | `0.85` |
| Section heading | `clamp(2rem, 4.4vw, 3.1rem)` | `-0.015em` | `0.94` |
| Panel heading | `1.15rem` | `0.02em` | tight |
| Stat value | `1.02rem` to `1.6rem` | normal | tight |
| Body | `0.88rem` to `1rem` | normal | `1.6` |
| Eyebrow | `0.6875rem` | `0.26em` | normal |
| Mono label | `0.6875rem` | `0.16em` | normal |

Two rules do the heavy lifting. Big type gets negative tracking and sub-1 leading so it reads as a single mass, the way board lettering does. Small mono type gets wide positive tracking and uppercase so it reads as a legend rather than as prose. Nothing sits in between, which is what keeps the hierarchy from muddying.

Every numeral that can change is `tabular-nums`, so animating values never reflow their container. Body copy uses `text-wrap: pretty` and headings use `text-wrap: balance`.

## Space and structure

Content sits in a `1200px` max-width column, `px-5` on mobile stepping to `px-8`. Sections are `py-20` stepping to `py-28`, which is generous enough that each section owns its screen without the page feeling padded.

Radii are small and intentional: `2px` on digit cells and chips, `4px` on panels, `8px` reserved. Buttons are near-square. Nothing on the page is a pill except the live pulse dot, and that is a circle because it is a light.

Panels are a `1px` `line` border, `floor-900` fill, and a 2.4%-white gradient across the top 42%. That top sheen is the only thing standing in for a light source, and it is why the panels read as physical surfaces instead of divs. Section content is separated by hairlines and `gap-px` on a `bg-line` container rather than by shadow, so the layout reads as an assembled board.

Grid tracks use `minmax(0, Nfr)` rather than bare `Nfr`, and every grid declares `grid-cols-1` before its responsive variant. Without both, grid children default to `min-width: auto` and unbreakable content like an address or a timestamp pushes the track wider than the viewport.

### Atmosphere

Three fixed layers, all `pointer-events-none`, all under the content: a brass bloom at the top, a radial vignette pulling the corners down, and an SVG `feTurbulence` grain at very low opacity. Together they cost nothing and stop the deep blacks from banding. There is no third-party texture image.

## Motion

Framer Motion throughout. Shared easing is `cubic-bezier(0.16, 1, 0.3, 1)`, exported as `EASE_BELL` from `lib/motion.ts` and mirrored as `--ease-bell` in CSS. It decelerates hard, which is what makes a value landing feel like it settled rather than glided.

### Reduced motion

`components/MotionRoot.tsx` wraps the tree in `MotionConfig reducedMotion="user"`. That is the whole strategy, and it matters for a reason beyond tidiness: components must not branch on `useReducedMotion()` to decide what to render, because the hook returns `null` on the server and a boolean after hydration, so branching produces markup mismatches. With `MotionRoot` in place, every component renders one tree and Motion strips transform and layout animations internally while keeping opacity and color.

`globals.css` covers the CSS side, collapsing animation and transition durations to `0.001ms` and switching the tape from an animation to a scrollable overflow so its content stays reachable.

Under reduced motion the ring still gives feedback. BellStage animates a short brass opacity flash (no swing), and the pot still updates. Nothing important is only communicated by movement.

### The ring sequence

The emotional center of the page. Stage motion is about 800ms, then a short settle and a 4s cooldown before another demo ring.

`BellStage` shows the static podium still by default. Ring the Bell plays `public/brand/bellwether-ring.mp4` through native `ended` (full multi-strike clip), then returns to the still and calls `finishRing()` for cooldown. No short hide timeout. Same click unmutes the hero YouTube BG. `mix-blend-screen` cleans residual black plates when the MP4 lacks real alpha. Reduced motion: skip the MP4, still unmute.

Hero background is a muted YouTube embed (`qxHmvXrc4Zk`) behind a dark scrim, hero-only, `pointer-events: none` on the iframe. Ring (user gesture) briefly unmutes; a small Sound off/on control sits under the ring label. `prefers-reduced-motion` keeps the CSS grain/gold/green fallback and never mounts the iframe. Embed only; the file is not in the repo.

Replacing art: drop `art/bellwether-podium-source.jpg`, run `node scripts/prepare-podium.mjs`. Nav still uses the small brass bell glyph, not the full podium.

The store phase machine runs `idle` → `ringing` → `settled` → `idle`, then holds a cooldown lock so the button cannot spam the demo.

### Idle

Bellwether holds the gavel high on a ~5.6s breath loop. Slow enough to register as presence rather than noise.

### Trust strip

A thin three-cell strip under the nav (Jackpot, Next bell, Total paid out). It is a summary, not a substitute for the full Bell Pot and Countdown sections.

### Value changes

`AnimatedNumber` drives a spring through a formatter, so a changing pot rolls to its new value instead of snapping. The `pot` feel is looser and slower than the default for the two hero numerals. It renders a plain formatted span until hydration, gated on the same `useHydrated` store as the clock, which keeps the server output deterministic.

`BoardDigits` renders the countdown as split-flap cells: each digit translates in from below while the outgoing one exits down, under `overflow: hidden`. Only the seconds cell changes most ticks, so the cost is two animating elements. Cell size steps down on mobile so `HH:MM:SS` stays on one line at 320px.

## Copy

Sentences, not fragments. Market vocabulary used correctly, because the audience will notice if it is not: window, sweep, settle, snapshot, pro-rata, tape.

No em dashes anywhere in the interface. No slash-wrapped decorative labels. No placeholder text and no fake controls: every button on the page does something or is honestly disabled with a `title` explaining why. Anything simulated says so at the point of interaction rather than in a footnote.

The locked rules appear as copy inside the sections they govern, not only in a rules list, so nobody has to scroll to find out that selling burns tickets.

Rules are stated with their reason attached wherever there is room. "Odds are capped at 10% per wallet" is a constraint; "the cap exists so one wallet cannot own the bell" is why anyone should accept it. Schedule copy matches `BELLS_24_7`: bells ring every day, the chain never sleeps.

Signal green `#00C805` is a brand accent for LIVE pips, nav/link hover, focus, and social hover. It is not a halo around Bellwether. Stage metal stays polished gold; strike emphasis is GME red.

### Honesty about what is live

Simulated language is kept tight. The Ring control is the only place that says "Simulated draw…". Demo rings in the winners feed keep a small `simulated` mark on the row. Address lookup stays read-only without a long mock sermon. CA and Chart stay placeholder/disabled until `NEXT_PUBLIC_TOKEN_ADDRESS` and `NEXT_PUBLIC_CHART_URL` are set.

**After Hours** carries one Coming soon badge and a bullish one-liner about the weekly GME pot. Stake controls stay disabled (`secondary`). The Roadmap section holds brass "Next" cards for what ships after the Bell Pot.

**Launch chrome** sits under the trust tape (and mirrors in the footer): truncated CA + Copy, Chart, Docs (`/docs` stub).

### Lore voice

Closing Bell borrows the thing everyone already knows from traditional markets: one ring that ended the day. On Robinhood Chain the market never sleeps, so the ritual can hit Open / Lunch / Close. Hero copy stays feeling + origin; mechanics live in How it works. No Robinhood feather, logo, or corporate biography, and no claim of official affiliation.

**How the Bell Works strip** sits tight between Hero and Bell Pot: lore kicker (“Wall Street had one closing bell…”), Buy → Tickets → Pot → Ring with light scroll stagger and brass arrow pulse, `public/brand/how-the-bell-works.jpg`, plus live Telegram/X links for `@ClosingBellOnRH` (not PNG-only).

**The address lookup** returns mocked data derived deterministically from the address bytes so hydration stays stable. Connect is a demo fill only.

### Copy that follows from the product

Most users will never trade through this page, so the interface stops implying they have to. Tickets are described as minted by the on-chain buy, with venue named as irrelevant: "bots, terminals, aggregators and this page all count the same." The site swap still exists, inside a disclosure whose own summary says it is optional.
