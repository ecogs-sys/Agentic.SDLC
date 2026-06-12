# Verdant Design System

A design system for modern admin web applications — focused on data tables, forms, dashboards, settings, and user management surfaces. Built around a deep forest-green primary palette with a professional, trustworthy feel.

> **Working brand name:** "Verdant" — replace throughout once a final brand name is confirmed.

---

## Sources

No external codebase or Figma files were attached. This design system was generated from scratch based on the following specification:

- **Preferred color:** Dark green (forest / deep direction)
- **Theme:** Both light and dark modes
- **App types:** Data tables & grids, forms & data entry, dashboards & analytics, settings & configuration, user management
- **Typography feel:** Modern & professional (geometric sans-serif)
- **Density:** Comfortable (balanced)
- **Accent color:** Light red (default) or purple — easily swappable via CSS variable

---

## CONTENT FUNDAMENTALS

**Tone:** Professional, direct, and trustworthy. The product speaks to power users — admins, operators, analysts. Copy is task-oriented, not conversational.

**Voice:**
- **Functional over friendly.** Labels are nouns or short verb phrases. "Save changes" not "Let's save your work!"
- **Sentence case everywhere.** Headers, labels, CTAs: all sentence case. Never title case except in proper nouns.
- **Second person ("you / your").** "Your team", "your account". Never "I" from the app's perspective.
- **Brevity.** Empty states get one line. Error messages say what went wrong and what to do. No fluff.
- **No emoji.** Iconography handles visual affordance; emoji are not used in UI.

**Casing rules:**
- Navigation items: sentence case
- Table column headers: sentence case
- Button labels: sentence case
- Modal titles: sentence case
- Status badges: ALL CAPS (e.g. ACTIVE, PENDING, ARCHIVED)

**Examples:**
- ✅ "Add team member" / ❌ "Add Team Member"
- ✅ "Something went wrong. Try again or contact support." / ❌ "Oops! That didn't work 😅"
- ✅ "No records found" / ❌ "Looks like it's empty here!"

---

## VISUAL FOUNDATIONS

### Colors
- **Primary:** Forest green scale — `#14532d` (darkest) through `#86efac` (lightest). Main interactive color is `--green-700` (#15803d). Active/hover uses `--green-600` (#16a34a).
- **Neutrals:** Cool-green-tinted grays. `--neutral-950` (near black) through `--neutral-50` (near white).
- **Accent:** Default red (`--accent-600` #dc2626) for destructive actions and alert states. Swappable to purple (`#7c3aed`) via single CSS variable change.
- **Semantic:** Success (green), Warning (amber), Error (red), Info (blue) — all desaturated slightly to stay calm in data-dense views.

### Typography
- **Primary font:** Plus Jakarta Sans (Google Fonts) — geometric, modern, highly legible at small sizes.
- **Mono font:** JetBrains Mono — for code, IDs, numeric data, terminal output.
- **Scale:** 11px (xs) → 12px (sm) → 14px (base) → 16px (md) → 20px (lg) → 24px (xl) → 32px (2xl) → 48px (3xl)
- **Weight range:** 400 (body), 500 (medium/label), 600 (semibold/heading), 700 (bold/display)
- **Line height:** 1.5 body, 1.25 headings, 1.0 labels/badges

### Backgrounds
- **Light mode:** `--bg-surface` #ffffff, `--bg-base` #f8faf9 (very light green tint), `--bg-subtle` #f1f5f2
- **Dark mode:** `--bg-surface` #111714, `--bg-base` #0d120f, `--bg-subtle` #192119
- No full-bleed hero images in admin UI. Section dividers use background color changes or subtle 1px borders.

### Spacing
- **Base unit:** 4px. Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px
- **Component padding:** Input/button: 8px 12px (compact) or 10px 16px (default)
- **Section gap:** 24px between form groups; 32px between page sections

### Borders & Radius
- **Border color (light):** `--border` #d4dbd6 (green-tinted gray)
- **Border color (dark):** `--border` #2a3d2e
- **Radius scale:** 4px (sm / chips, badges), 6px (default / inputs, buttons), 8px (md / cards, modals), 12px (lg / panels), 16px (xl / dialogs)
- **No pill-shaped buttons** by default; 6px radius is the standard.

### Shadows / Elevation
- **Level 0:** No shadow (flat, in-page elements)
- **Level 1:** `0 1px 2px rgba(0,0,0,0.08)` — cards, dropdowns
- **Level 2:** `0 4px 12px rgba(0,0,0,0.12)` — modals, popovers
- **Level 3:** `0 8px 24px rgba(0,0,0,0.18)` — command palette, overlays
- Shadow color has a green tint in dark mode: `rgba(0,30,10,0.4)`

### Animation
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out spring) for entrances; `ease-in` for exits
- **Duration:** 120ms micro (hover), 180ms standard (show/hide), 280ms large (modal open)
- **No bounce.** Admin UI is professional — subtle fades and slides only.
- Hover states: background color shift (+/- one shade). No opacity tricks.
- Press states: slight darkening (not scale/shrink).

### Cards
- Background: `--bg-surface`, border: 1px `--border`, radius: 8px, shadow: Level 1
- Inner padding: 20px (default), 16px (compact), 24px (spacious)
- Header rule: 1px `--border` between card header and body if header exists

### Imagery
- No decorative imagery in admin UI — data is the content.
- Status illustrations (empty states) are simple geometric SVGs in brand green tones.
- No gradients on backgrounds; only subtle on interactive elements (button hover).

### Corner Radii Summary
- `--radius-sm: 4px` — badges, tags, chips
- `--radius-md: 6px` — inputs, buttons, selects
- `--radius-lg: 8px` — cards, tooltips, dropdowns
- `--radius-xl: 12px` — modals, panels
- `--radius-2xl: 16px` — large dialogs, sheets

---

## ICONOGRAPHY

**Approach:** Lucide Icons (CDN) — stroke-based, 24×24 viewBox, 1.5px stroke, rounded linecaps. Loaded from `https://unpkg.com/lucide@latest/dist/umd/lucide.min.js`.

**Usage rules:**
- Icons are always 16px (small / inline), 20px (default / button), or 24px (standalone / heading)
- Icon color follows text color: `--fg-2` for decorative, `--fg-1` for actionable, `--color-primary` for selected/active
- No emoji used as icons
- No unicode characters as icons
- No PNG icons — SVG only

**Icon vocabulary (examples):**
- Navigation: `layout-dashboard`, `users`, `settings`, `database`, `shield`, `bar-chart-2`
- Actions: `plus`, `edit-2`, `trash-2`, `download`, `upload`, `filter`, `search`, `more-horizontal`
- Status: `check-circle`, `x-circle`, `alert-triangle`, `info`, `clock`
- Data: `table`, `columns`, `sort-asc`, `sort-desc`, `chevron-down`, `chevron-up`

---

## FILE INDEX

```
README.md                         ← This file
SKILL.md                          ← Agent skill descriptor
colors_and_type.css               ← All CSS custom properties (colors, type, spacing, radius, shadow)

preview/
  colors-primary.html             ← Primary green scale
  colors-neutral.html             ← Neutral scale
  colors-semantic.html            ← Semantic / status colors
  colors-accent.html              ← Accent (red/purple) scale
  type-scale.html                 ← Type scale specimen
  type-specimens.html             ← Heading + body specimens
  spacing-tokens.html             ← Spacing scale
  radius-shadow.html              ← Radius + shadow system
  components-buttons.html         ← Button variants
  components-inputs.html          ← Form inputs + selects
  components-badges.html          ← Badges, chips, status pills
  components-cards.html           ← Card variants
  components-table.html           ← Data table component
  components-nav.html             ← Sidebar + topbar navigation

ui_kits/admin/
  index.html                      ← Full admin app prototype
  Sidebar.jsx                     ← Navigation sidebar
  TopBar.jsx                      ← App topbar
  DataTable.jsx                   ← Data table with sort/filter
  FormComponents.jsx              ← Input, Select, Checkbox, Radio, Toggle
  Dashboard.jsx                   ← Dashboard with charts + stats
  UsersScreen.jsx                 ← User management screen
  SettingsScreen.jsx              ← Settings screen
```
