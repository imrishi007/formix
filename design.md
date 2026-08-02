# Formix Design System

## Philosophy
Apple product-page polish + Linear/Vercel restraint. Warm, colorful, professional — never generic AI-gradient-slop. Glassmorphism used deliberately on floating/elevated surfaces, not everywhere. Every color has a job; no decoration for decoration's sake. The page reads as one continuous surface — no scroll-triggered reveals, no section-to-section hard seams. Supports both light and dark theme, switchable via a persistent toggle, with one identity that holds across both.

**Accent moved from violet to blue this pass** — violet was reading as generic AI-startup purple. New direction: a real navy blue, closer to what a code-editor theme like Catppuccin uses for its blue/sapphire tones, not a bright SaaS-purple.

---

## Color System

Built in OKLCH so lightness steps are perceptually even across the whole scale. Every color below is a multi-step scale, not a single flat token.

### Light-theme neutral scale (warm, used for light mode only now — see dark-theme neutral below, it's a separate scale, not an inversion of this one)
```
--neutral-50:  oklch(98.5% 0.004 90)   /* warm, not pure white */
--neutral-100: oklch(96.5% 0.006 85)
--neutral-150: oklch(94% 0.007 85)
--neutral-200: oklch(91% 0.008 80)
--neutral-300: oklch(84% 0.009 80)
--neutral-400: oklch(70% 0.010 75)
--neutral-500: oklch(55% 0.010 75)
--neutral-600: oklch(42% 0.009 75)
--neutral-700: oklch(30% 0.008 70)
```

### Dark-theme neutral scale (navy slate — a genuinely different hue from the light scale, not an inverted brightness of it)
This is the fix for "dark theme kinda sucks" — a flipped warm-gray reads flat and generic. A real navy dark theme needs its own cool-hued scale, in the spirit of Catppuccin Mocha's base/surface colors:
```
--navy-950: oklch(16% 0.025 265)   /* ~#1e1e2e Catppuccin-Mocha-base territory — page background */
--navy-900: oklch(19% 0.028 265)   /* ~#181825 mantle — slightly recessed panels */
--navy-850: oklch(23% 0.030 264)   /* card/surface background */
--navy-800: oklch(28% 0.032 263)   /* elevated surface / hover */
--navy-700: oklch(35% 0.030 262)   /* borders, dividers */
--navy-600: oklch(45% 0.028 260)   /* muted text, disabled */
--navy-500: oklch(58% 0.024 258)   /* secondary text */
--navy-300: oklch(78% 0.020 255)   /* primary text on dark */
--navy-100: oklch(92% 0.012 255)   /* brightest text, headings */
```

### Blue accent scale (primary brand color, replaces violet — both themes)
Tuned toward the same family as Catppuccin's Blue/Sapphire, not a bright electric blue:
```
--blue-50:  oklch(96% 0.02  255)
--blue-100: oklch(91% 0.04  256)
--blue-200: oklch(84% 0.07  257)
--blue-300: oklch(75% 0.10  258)
--blue-400: oklch(68% 0.13  259)   /* dark-mode primary — lighter for contrast against navy bg */
--blue-500: oklch(58% 0.16  260)   /* light-mode primary — buttons, links, brand mark */
--blue-600: oklch(50% 0.16  260)   /* light-mode hover */
--blue-700: oklch(42% 0.15  261)
--blue-800: oklch(33% 0.12  262)
--blue-900: oklch(24% 0.08  263)
```

### Amber accent scale (secondary emphasis, highlights — unchanged)
```
--amber-100: oklch(94% 0.05  75)
--amber-300: oklch(83% 0.13  73)
--amber-500: oklch(72% 0.17  70)
--amber-700: oklch(52% 0.15  55)
```

### Emerald / Rose (success / danger — unchanged)
```
--emerald-100: oklch(93% 0.045 155)
--emerald-500: oklch(58% 0.13  155)
--emerald-700: oklch(40% 0.10  155)
--rose-100: oklch(93% 0.035 15)
--rose-500: oklch(58% 0.18  15)
--rose-700: oklch(42% 0.15  15)
```

### Background hue whisper (kills flat single-color backgrounds)
- Light: soft radial wash of `--blue-50` at 35% opacity, top-left origin, fading to `--neutral-50` by 60% of viewport
- Dark: soft radial wash of `--blue-900` at 30% opacity, top-left origin, fading to `--navy-950` by 60% of viewport — this is what separates a good navy dark theme from a flat black one; the wash should be visible enough to register as "navy," not just barely-there

---

## Theme Tokens

### Light theme
```
--bg-base:          var(--neutral-50)
--bg-subtle:        var(--neutral-100)
--bg-surface:       #FFFFFF
--bg-surface-glass: color-mix(in oklch, white 65%, transparent)
--ink-primary:      var(--neutral-700)   /* near-black, not pure black */
--ink-secondary:    color-mix(in oklch, var(--neutral-700) 70%, var(--neutral-400))
--ink-tertiary:     var(--neutral-400)
--border-hairline:        color-mix(in oklch, var(--neutral-700) 8%, transparent)
--border-hairline-strong: color-mix(in oklch, var(--neutral-700) 14%, transparent)
--border-glass:            color-mix(in oklch, white 60%, transparent)
--accent-primary:      var(--blue-500)
--accent-primary-hover: var(--blue-600)
--accent-primary-tint:  var(--blue-50)
```

### Dark theme
```
--bg-base:          var(--navy-950)
--bg-subtle:        var(--navy-900)
--bg-surface:       var(--navy-850)
--bg-surface-glass: color-mix(in oklch, var(--navy-850) 55%, transparent)
--ink-primary:      var(--navy-100)
--ink-secondary:    var(--navy-300)
--ink-tertiary:     var(--navy-600)
--border-hairline:        color-mix(in oklch, white 8%, transparent)
--border-hairline-strong: color-mix(in oklch, white 14%, transparent)
--border-glass:            color-mix(in oklch, white 12%, transparent)
--accent-primary:      var(--blue-400)   /* lighter than light-mode blue-500, for contrast on navy */
--accent-primary-hover: var(--blue-300)
--accent-primary-tint:  var(--blue-900)
```

Shared semantics:
```
--accent-secondary:      var(--amber-500)
--accent-success:        var(--emerald-500)
--accent-danger:         var(--rose-500)
```

**Rule:** no hardcoded hex in components — everything references a token, so the toggle is a variable swap. No purple/violet anywhere in either theme now — blue is the single brand accent.

---

## Theme Toggle — fix from last pass
Current implementation shows the literal words "LIGHT" / "DARK" on hover, which looks unfinished. Replace with:
- A single icon-only pill (sun icon / moon icon, swapping based on active theme — not two labeled halves)
- No native browser `title` tooltip. If a tooltip is wanted, build a custom small glass tooltip matching the design system, delayed ~500ms, positioned below the icon — never overlapping or obscuring the button itself
- Glass pill styling (`--bg-surface-glass` + blur), `--radius-md`, sits in the nav next to the primary CTA
- 200ms crossfade on the swap, icon rotates/fades between sun and moon rather than being replaced abruptly

---

## Code Editor — now theme-synced, not fixed-dark
Previous rule kept Monaco permanently dark regardless of app theme — reversing that. The editor should visually match whichever app theme is active, using real, well-tested syntax themes rather than inventing new syntax colors:

- **Dark theme → Catppuccin Mocha** for the Monaco canvas. Reference tokens: base `#1e1e2e`, mantle `#181825`, surface0 `#313244`, text `#cdd6f4`, blue `#89b4fa`, mauve `#cba6f7`, green `#a6e3a1`, yellow `#f9e2af`, peach `#fab387`, red `#f38ba8`. This is a known, published theme — use its actual token set rather than approximating.
- **Light theme → Catppuccin Latte** for the Monaco canvas. Reference tokens: base `#eff1f5`, mantle `#e6e9ef`, text `#4c4f69`, blue `#1e66f5`, mauve `#8839ef`, green `#40a02b`, yellow `#df8e1d`, peach `#fe640b`, red `#d20f39`.
- Editor chrome (tab bar, file explorer, status bar) continues to use the app's own token system (`--bg-surface`, `--border-hairline`, etc.) from the tables above — only the Monaco canvas itself uses the Catppuccin tokens, so the code area and its immediate frame read as one coherent surface per theme instead of a generic-dark-editor-in-a-light-app mismatch.
- Formix's own brand blue (`--accent-primary`) and Catppuccin's blue are close enough in hue that UI accents and code syntax highlighting will feel like one family, which is the point of this pairing.

---

## Logo — still outstanding, one persistent identity everywhere
This has not shipped yet — the editor top-bar in the last screenshot still shows the old "FX" square mark. Needed this pass:
- One SVG logo component, one asset, used identically in: landing nav, docs header, editor top-bar (currently "FX" square — replace), dashboard nav, loading screens.
- **Also wire it as the actual browser favicon and OG/share image** — currently still the default. Export the mark at 16/32/180px (favicon + apple-touch-icon sizes) from the same source SVG, don't hand-draw a separate simplified version.
- Mark direction: something intrinsic to Formix as a compiler/DSL for forms — an abstracted bracket/pipe pair, a monospace glyph treated as a wordmark lockup, or a stylized field/input shape. No sparkle, no gradient orb, no abstract blob.
- Recolors via `--ink-primary` (mono) or `--accent-primary` (color) depending on context/theme — same shape, never redrawn.

---

## Typography
- **Display/Headings:** Geist, weight 550–650, tracking -0.02em, line-height 1.1 — H1 56-64px desktop / 36-40px mobile, H2 36-40px, H3 24-28px
- **Body:** Geist, weight 400, 16-18px, line-height 1.6, color `--ink-secondary`
- **Small/Caption:** Geist, weight 500, 13-14px, color `--ink-tertiary`, letter-spacing 0.02em
- **Code/Mono:** Geist Mono or JetBrains Mono, 14px, line-height 1.7 — matches the editor's own font choice

Fallback stack: `'Geist', 'Inter Tight', -apple-system, sans-serif`

---

## Spacing Scale
`4, 8, 12, 16, 24, 32, 48, 64, 96, 128` (px)

## Radius Scale
- `--radius-sm: 8px` — inputs, small chips, checkboxes
- `--radius-md: 14px` — buttons, small cards, theme toggle
- `--radius-lg: 20px` — standard cards, panels
- `--radius-xl: 28px` — hero panels, macbook-mockup frame
- Pills: `9999px` — badges, status chips

## Shadows
Light theme:
```
--shadow-sm: 0 1px 2px oklch(20% 0 0 / 4%), 0 1px 1px oklch(20% 0 0 / 3%)
--shadow-md: 0 4px 12px oklch(20% 0 0 / 6%), 0 2px 4px oklch(20% 0 0 / 4%)
--shadow-lg: 0 12px 32px oklch(20% 0 0 / 8%), 0 4px 8px oklch(20% 0 0 / 4%)
--shadow-glass: 0 8px 32px var(--blue-500 / 10%), inset 0 1px 0 oklch(100% 0 0 / 50%)
--shadow-btn-primary: 0 8px 24px var(--blue-500 / 20%)
```
Dark theme (glow-based, not gray-shadow-based):
```
--shadow-sm: 0 1px 2px oklch(0% 0 0 / 30%)
--shadow-md: 0 4px 16px oklch(0% 0 0 / 40%), 0 0 0 1px var(--border-hairline)
--shadow-lg: 0 16px 40px oklch(0% 0 0 / 50%), 0 0 0 1px var(--border-hairline)
--shadow-glass: 0 8px 32px var(--blue-400 / 15%), inset 0 1px 0 oklch(100% 0 0 / 8%)
--shadow-btn-primary: 0 0 24px var(--blue-400 / 35%)
```

---

## Component Rules

### Buttons
**Primary**
- Background: `--accent-primary` solid (blue-500 light / blue-400 dark), or a max-2-color gradient within the blue scale on one hero CTA only
- Text: white in light mode; check contrast in dark mode against the lighter `--blue-400` fill — likely still white, verify against `--navy-950`
- Radius: `--radius-md` (14px), not a pill
- Padding: 14px vertical / 28px horizontal
- Shadow: `--shadow-btn-primary` (glow in dark mode, soft shadow in light mode)
- Hover: `scale(1.02)`, shadow grows ~20%, background shifts to `--accent-primary-hover`
- Active: `scale(0.98)`, shadow shrinks

**Secondary/outline:** transparent or glass background, `--border-hairline-strong`, `--ink-primary` text, same radius, fills to `--bg-subtle` on hover.

**Disabled:** opacity 40%, no hover/active, `cursor: not-allowed`.

### Cards
`--bg-surface`, `--radius-lg`, `--border-hairline`, `--shadow-sm` at rest / `--shadow-md` on hover, 24px padding, no icon-in-colored-square clichés.

### Landing-page feature sections
No 6-up icon-grid tiles. Fewer, larger sections mixing real screenshots and copy. Cap short feature lists at 3 items, vary layout. No hard color-block transitions — background wash carries through.

### Glassmorphism
`--bg-surface-glass` + `backdrop-filter: blur(24px) saturate(180%)` + `--border-glass` + `--shadow-glass`. Applies to: nav bar, theme toggle, modals/dropdowns, Formix AI panel, hero floating elements. Needs the background wash underneath to read as glass. Not on every card.

### Depth / 3D
MacBook mockup: `perspective(1200px) rotateX(4deg)` at rest, straightens on hover/pointer — pointer-driven, never scroll-driven. Optional subtle pointer-parallax on hero elements. Nothing competing with real product screenshots.

### Dashboard — Forms List / Row Actions
Edit + Analytics always-visible inline icons; "..." for Duplicate/Delete/Rename. Row hover: `--bg-subtle` + `--shadow-sm`. Status badges: pill, `--accent-success` tint for Published, neutral tint for Draft.

### Analytics / Field Response Cards
Large bold stat numbers. Charts: `--accent-primary` primary series, `--accent-secondary` comparison series, no rainbow palettes. Progress bars: `--accent-primary` fill on `--bg-subtle` track.

---

## Motion
No scroll-triggered animations — no fade-in, scale-in, or reveal-on-scroll. Content visible immediately on load.
- Hover transitions: 150-200ms ease-out
- Theme swap: 200ms crossfade, no flash or layout shift
- MacBook mockup tilt: hover/pointer-driven only
- Page transitions: opacity crossfade only
- No spring/bounce overshoot anywhere, either theme


# Formix Design System

## Status
- **Light theme: LOCKED.** Do not touch. It's finished and approved.
- **Dark theme: FULL REBUILD.** Everything below replaces the current dark theme.

---

## Light Theme (reference only — do not modify)
- Background: warm off-white
- Ink: near-black
- Accent: blue (buttons, links, active states) — this exact blue carries over to dark mode, see below
- Typography: Instrument Serif / Instrument Sans / JetBrains Mono
- Panels: square-bordered, subtle glassmorphism (blur + low-opacity white fill) — full strength, works well here

---

## Dark Theme (new)

### Principle
A real navy code-editor theme — not an inverted/dimmed version of the light theme, and not purple/violet. Think Catppuccin Mocha / Tokyo Night territory: deep blue-black base, one confident blue accent, muted secondary text. No purple anywhere.

### Base colors
| Token | Hex | Use |
|---|---|---|
| `bg-base` | `#0A0E17` | App background, outermost layer |
| `bg-surface` | `#0F1522` | Cards, panels, nav bar |
| `bg-surface-raised` | `#141B2B` | Editor panel, modals, hover states |
| `border-subtle` | `#1E2536` | Default panel/card borders |
| `border-strong` | `#2A3348` | Focused inputs, active panel borders |
| `text-primary` | `#E6E9F0` | Headings, primary content |
| `text-secondary` | `#9AA4B8` | Body copy, descriptions |
| `text-muted` | `#5C6779` | Placeholder, disabled, timestamps |

### Accent (the fix)
| Token | Hex | Use |
|---|---|---|
| `accent` | `#5B8DEF` | Primary buttons, links, active nav underline — same family as the light-theme blue, just tuned to sit right on the dark base |
| `accent-hover` | `#4A7CE0` | Hover state on accent elements |
| `accent-soft` | `#5B8DEF` at 12% opacity | Selected states, subtle highlights, badge backgrounds |
| `accent-glow` | `#5B8DEF` at 25% opacity, blurred | Optional subtle glow behind hero CTA only — use sparingly |

No purple, no violet, no indigo drift. If a gradient is used anywhere, it should shift between two blues (e.g. `#5B8DEF` → `#3D6BC7`), never toward purple.

### Semantic colors (errors, success, warnings — unchanged across themes)
| Token | Hex |
|---|---|
| `success` | `#4ADE80` |
| `error` | `#F87171` |
| `warning` | `#FBBF24` |

### Glassmorphism — dark theme (toned down)
The light theme's glass effect is full-strength and correct. In dark theme it currently reads as too heavy/milky. Fix:
- `backdrop-blur`: reduce from current value to **8px max** (light theme can stay higher if it's already tuned)
- Fill opacity: reduce translucent white/light fill to **4–6% white**, not 10%+
- Border: 1px `border-subtle` (`#1E2536`), not a bright glass edge
- Drop the inner highlight/sheen if one is currently applied — it's what's making it look heavy
- Glass should read as "a slightly lighter pane of dark glass," not "a frosted white layer over dark background"

### Code editor syntax colors (dark theme)
Should feel like a proper editor theme, matching the app's navy base — not a generic VS Code dark import:
- Keywords (`form`, `field`, `validate`, `ui`, `action`): `#5B8DEF` (accent blue)
- Types (`text`, `email`, `select`): `#4ADE80` (soft green)
- Strings: `#E0B989` (warm amber, muted)
- Numbers: `#F0A868`
- Property names (`label`, `placeholder`): `#9AA4B8` (secondary text)
- Comments: `#5C6779` (muted text)
- Background: `bg-surface` (`#0F1522`), not pure black

### Buttons (dark theme)
- Primary: `accent` fill (`#5B8DEF`), `text-primary` text, no border
- Primary hover: `accent-hover` fill
- Secondary: transparent fill, `border-strong` border, `text-primary` text
- Match the weight/shape/radius of the light-theme buttons exactly — only the color logic changes

---

## Typography
Unchanged across both themes: Instrument Serif (display), Instrument Sans (body/UI), JetBrains Mono (code).

## Shape language
Unchanged across both themes: square-bordered panels, no heavy rounded-corner softness, minimal shadow depth.