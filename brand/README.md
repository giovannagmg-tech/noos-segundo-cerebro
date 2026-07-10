# Handoff: Noos — Personal Second Brain (Brand System)

## Overview
"Noos" (from Greek *nous* — mind/intellect) is a personal second-brain app covering four areas: **notes, tasks, habits, and languages**. This handoff captures the **finalized brand system** (logo, color palette, typography, base components) that came out of a design exploration process. No production screens have been built yet — this package is the foundation the app's UI should be built on top of.

## About the Design Files
The bundled file (`Noos - Design Explorations.dc.html`) is an **HTML design-exploration document**, not production code. It contains the full back-and-forth of the design process: multiple discarded directions stacked as sections (each tagged with an id badge like `1a`, `9b`, `10a`), with the **final approved system in the section labeled `10` / option `10a`** (scroll to the bottom-most/first section — newest work is at the top of the file, so `10a` is the top section). Earlier sections (dashboards, mobile mockups, alternate logos/palettes) are references for layout/interaction ideas only — their colors are **outdated** (they predate the final palette) and should not be copied as-is.

**Task: recreate this system in the target codebase's actual environment** (React, Swift/SwiftUI, native Android, etc. — whichever the project uses, or the best modern choice if starting fresh). Do not ship the HTML directly.

## Fidelity
**High-fidelity for the brand system** (logo, palette, type, base components — exact values below). **No app screens exist yet at this fidelity.** Layout ideas from earlier explorations (dashboard with sidebar, mobile card feeds, journal/timeline views) are low-fidelity direction only — structure and spirit, not pixel-exact.

## Logo
- Wordmark: lowercase **"noos"**, weight 800, tight tracking (`letter-spacing: -2px` at large display sizes).
- The two middle "o"s are replaced by a custom mark: **two overlapping circles** (stroke-only rings, no fill on the outer ring), stroke color = ink (dark sage, see palette). Where the two rings overlap, the overlap area ("lens") is filled solid with the brand accent color (terracotta-red).
- Construction (SVG, 140×100 viewBox):
  - Ring A: `circle cx=52 cy=50 r=30`, stroke ink, stroke-width 8 (scale proportionally to size)
  - Ring B: `circle cx=88 cy=50 r=30`, stroke ink, stroke-width 8
  - Lens fill: clip Ring B to a circle at `cx=52 cy=50 r=30` and fill solid with accent color, then redraw Ring A's stroke on top so the outline stays crisp
- Vertical alignment: because lowercase "n"/"s" glyphs have no ascender/descender, their optical center sits slightly below the mid-point of the font's em-box. When centering the ring-mark svg against the text with `align-items: center` in a flex row, nudge the svg down with `position: relative; top: 3px` at 84px display size (~3.5% of font-size; scale proportionally at other sizes) so the rings line up with the letters instead of floating high.
- App-icon tile version: rings only (no letters), in ink color on white, or white rings on any brand color background — see the 4 example tiles in `10a`.

## Design Tokens

### Colors (OKLCH — valid CSS, use directly)
Base:
- `--color-bg-cream: oklch(97% 0.012 75)` — page background
- `--color-surface: #ffffff` — card/surface background
- `--color-ink: oklch(30% 0.02 140)` — primary text, logo stroke (dark sage-black)
- `--color-brand: oklch(58% 0.18 25)` — brand accent / primary button / logo lens fill (red)
- `--color-border-subtle: oklch(90% 0.01 75)` — hairline borders on swatches/dividers

Category colors (each area of the app gets its own accent, used as icon-tile background + tag pill):
- Notas (Notes): tag bg `oklch(92% 0.05 25)`, tag text `oklch(45% 0.16 25)` (warm red family)
- Tarefas (Tasks): tag bg `oklch(90% 0.04 140)`, tag text `oklch(38% 0.05 140)` (sage green)
- Hábitos (Habits): tag bg `oklch(92% 0.06 40)`, tag text `oklch(48% 0.10 40)` (peach)
- Idiomas (Languages): tag bg `oklch(90% 0.02 75)`, tag text `oklch(45% 0.03 75)` (sand)

### Typography
- Family: **Plus Jakarta Sans** (Google Fonts) — the only typeface in the system.
  - Weight 800: display/titles
  - Weight 700: emphasis/subheads
  - Weight 500: body copy
  - Weight 600: labels/tags (used at 10-11px, letter-spacing ~1-1.5px, often uppercase)
- Secondary/mono accent: **Space Mono** (Google Fonts), weight 600-700, used only for small meta labels and tag text in the exploration doc — optional, evaluate if needed for the real app.
- Scale used: 84px (hero logo display) / 34px / 26px / 18px / 14-15px (body) / 11-13px (labels).

### Radius & shape
- Cards: 16-20px radius
- Buttons: 12px radius
- Tag pills: fully rounded (`border-radius: 20px`)
- Icon tiles: 10-16px radius

### Components (see "COMPONENTES" row in `10a`)
- **Card**: white surface, 16px radius, ~14-20px padding, no border, sits on cream page background.
- **Tag/pill**: category color at ~90% lightness background, matching darker text color, 3-4px vertical / 8-10px horizontal padding, fully rounded.
- **Primary button**: brand accent (red) background, white text, weight 700, 12px radius, ~14x22px padding.
- **Empty state**: dashed border (2px, subtle gray), no fill, muted label text, 12px radius.
- **Icon tile** (used per note/task card): 30-34px square, 10px radius, tinted with the category color, single emoji or icon centered.

## Assets
No external images — the logo is pure SVG/CSS (two circles + text), fonts are loaded from Google Fonts (Plus Jakarta Sans, Space Mono). No other icon set has been chosen yet; emoji were used as content-icon placeholders in mockups (💡 🎙️ 🔥 🗣️) — decide whether to keep emoji or move to a custom icon set when building the real app.

## Screens
None built yet at final fidelity. Earlier low-fidelity direction (colors are outdated, ignore hex/oklch values used in these, reference structure only):
- **Mobile home / capture hub** — top greeting, big primary "capture a thought" button, list of today's cards below, bottom tab bar (4 icons).
- **Mobile daily journal** — either day-blocks (grouped by date, expandable), a vertical timeline with time-stamped dot markers, or a calendar-strip + mood-tagged entry cards.
- **Web dashboard** — fixed left sidebar (logo + nav: Início/Diário/Projetos/Buscar, plus a "coleções" list with colored dots), main content area with a horizontal date-strip and a card grid.

These should be treated as a **starting point for layout conversations**, not a spec — work out final navigation/IA (how notes, tasks, habits, and languages relate to each other in the nav) as part of building the real screens.

## Interactions & Behavior / State Management
Not yet defined — this handoff is brand-system only. The next step is to design the actual screens (Home, Notes, Tasks, Habits, Languages) using these tokens, at which point interactions and state should be documented per-screen.

## Files
- `Noos - Design Explorations.dc.html` — full design exploration history. Final system: section `10`, option `10a`.
