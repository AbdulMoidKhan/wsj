# Workspace Junction — Design Language

**Your business. Connected.** Start it. Establish it. Work on it. Create for it. Grow it.

Workspace Junction is a connected business ecosystem, not a coworking company. Every page
should let a visitor see the whole ecosystem and where they stand in it.

## The idea
The six chapters of a business (**Start · Establish · Work · Create · Grow · Connect**) are the
brand's organizing device. They come from one module, `lib/ecosystem.ts`, and appear as:

- the six colour swatches beside the homepage hero photograph (first viewport);
- the homepage **Ecosystem Explorer** (`components/ecosystem-explorer.tsx`), the page's one live
  thing: ARIA tabs, hover/click/tap/arrow keys, mask-wipe photographs, real service links;
- the header route strip (chapter verb in amber, then its key services; current chapter on green);
- the inner-page hero, whose composition is chosen by the page's chapter.

## Colour
| Role | Token | Hex | Use |
|---|---|---|---|
| Primary | `--wj-green` | `#0E3421` | chapters, explorer, community, primary buttons |
| Deep | `--wj-deep` | `#092317` | header strip, closing statement, work hero |
| Night | `--wj-night` | `#06140D` | studio / create chapter only |
| Amber | `--wj-amber` | `#D7902A` | accent: CTAs, chapter verbs, indicators, growth field |
| Amber ink | `--wj-amber-ink` | `#7D5212` | amber as text on light grounds (≥ 6:1) |
| Cream | `--wj-cream` | `#F7F4ED` | page ground |
| Ivory | `--wj-ivory` | `#FFFDF8` | paper: price sheet, FAQ, visit card |
| Sage | `--wj-sage` | `#E9EDE6` | establish / foundation fields |
| Ink | `--wj-ink` | `#10271C` | text |

Whole sections change field colour (cream → green → cream → sage → amber → night → ivory …).
Surfaces are separated by tone, never by outlines or resting shadows. No decorative gradients;
the only gradient is a neutral scrim under text on a photograph.

## Type (Atelier redesign)
Two families, loaded in `app/layout.tsx` via next/font:
- **Newsreader** (`--font-serif`, aliased as `--font-display` / `--ui-heading-font`): every heading, 400 weight,
  tracking -0.02 to -0.035em. Accent words are set in *italic* (`<em>`): green on light grounds, amber on dark.
- **Manrope** (`--font-sans`, `--ui-body-font`): reading text 16-19px / 1.65, UI controls 600 weight.
- Section labels: amber dot + 13px uppercase Manrope (`.h-intro-label`, `.fx-eyebrow`).

## Shape and space
- Corners: photographs and cards 20-32px; controls are pills (999px); thin rules never round.
  New scopes (`.junction-home`, `.at-header`, `.at-footer`, `.at-closing`, `.jx-hero`) set their own radii.
- Sections on inner pages are rounded panels inset 10-18px from the viewport edge.
- Margins: `--wj-gutter` = clamp(20px, 3.4vw, 56px); content max 1440px.
- The redesign layer is `app/atelier.css` (loaded last); header = `.at-header` in `components/site-shell.tsx`.

## Inner-page compositions (`.jx-hero[data-chapter]`, app/junction-system.css)
| Chapter | Personality | Composition |
|---|---|---|
| work | architectural | full-bleed room photograph, copy on a deep-green plinth |
| start | confident, entrepreneurial | green field, large type, tall photograph to the right edge |
| establish | trustworthy | ivory paper under an amber rule, framed 4:5 photograph |
| create | cinematic | night field, wide title, 21:8 letterboxed studio below |
| grow | creative agency | full amber field, ink type, square photograph |
| connect | editorial, warm | photograph fills left half, invitation on green |
| guide | use cases and other routes | sage, photograph right |

## The junction marker
The brand's signature device, on the homepage and every inner page: **section number + a 40px
amber pathway line + the chapter label** (`.j-marker`, and `.fx-eyebrow` on inner pages, numbered
by CSS counters). It replaces tiny uppercase eyebrows. Lists of services use the same language:
numbered directory rows on 2px graphic lines, never icon-topped cards.

## Inner-page sections (`app/figma-chapters.css`, route CSS)
Below the hero, each chapter gets its own field sequence: Work cream/ivory with large
photography; Establish ivory/sage; Start and Connect deep green chapters; Grow amber chapters;
Create a cinematic night throughout. Pricing and forms keep light functional surfaces. Each page
ends with one full-width closing band; the shared "Good things happen" band steps aside when a
page already has its own closing.

## Motion
Purposeful and short. Hero lines rise in sequence (no delay to the message); hero photographs
settle from 1.06–1.08 scale; explorer frames open with a clip-path wipe; the spaces band widens
the hovered room; the growth index fills ink and reveals a thumbnail; arrows lift on hover.
GSAP `[data-reveal]` entrances below the fold. Everything is visible without JavaScript and every
move has a `prefers-reduced-motion` fallback. The WebGL backdrop and ambient glow layers were
retired (performance, and they read as generic decoration).

## Imagery
Use the project's own photographs (coworking floor, boardroom, mailboxes, studio, events,
reception). Never fabricate facility photos, testimonials, statistics or portfolios. Avoid the
AI-generated library images (`Gemini_*`, `ChatGPT-*`) in hero positions.

## Data rules
Prices, plans, studio rates, testimonials, use cases and stats are always read from the catalog/CMS.
A price line renders only when the catalog resolved it; otherwise “Ask our team”.

## CSS architecture
- `app/consistency-system.css` (layer `wj-consistency`) is the token contract: brand colours,
  Inter, fluid type scale, 2px radius. `.junction-home` and `[data-art]` scopes are exempt from its
  heading/paragraph forcing so art-directed sections can set their own scale.
- `app/button-system.css` (layer `wj-button-contract`): brand button tokens; `.wj-control` opts a
  component-styled control out.
- `app/junction-system.css`: brand tokens, header strip, inner heroes, pricing grid. Overrides of
  layered rules live inside `@layer wj-consistency`, never as new unlayered `!important` piles.
- `app/_home/junction-home.css` (with `app/_home/junction-page.tsx`): homepage only, scoped to `#main.junction-home`.
- `app/figma-chapters.css` and `app/figma-pages.css`: imported by the inner-page template only.
- `app/legacy-routes.css`: rules from `homepage.css`, `inner-pages.css`, `inner-redesign.css` and
  `services-redesign.css` that were measured unused on the homepage, service pages and shared
  components (28 routes, desktop + phone, menu and booking dialog open). It is imported by every
  route module except the homepage, so legacy templates (posts, categories, `/membership-plans/`,
  use-case detail, utility pages) keep their styles. The split was verified with a pixel-diff of
  eight routes (zero difference). Re-measure before deleting anything from it.
- Motion: `components/deferred-motion.tsx` arms GSAP on first user input (or after 5s idle);
  `components/junction-motion.tsx` holds the homepage scenes.
