# Portal Redesign — Design Spec

## Goal

Replace the flat, grey portal UI with a vibrant, modern design using Inter font, an indigo sidebar, and colour-accented stat cards across all pages. The redesign covers the sidebar, organisation dashboard, and property dashboard.

## Design Tokens

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#6366f1` | Indigo — GCS, primary actions, active sidebar |
| `--color-teal` | `#14b8a6` | Properties, feedback counts |
| `--color-purple` | `#8b5cf6` | Anticipation pillar, status |
| `--color-orange` | `#f97316` | Alerts, Recognition pillar |
| `--color-sidebar-from` | `#1e1b4b` | Sidebar gradient top |
| `--color-sidebar-to` | `#312e81` | Sidebar gradient bottom |
| `--font-sans` | `'Inter', system-ui, sans-serif` | All text |

Inter loaded via: `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap`

## Sidebar

**Background:** linear gradient `#1e1b4b → #312e81` (top to bottom).
**Text:** white at 65% opacity; active item white at 100%.
**Active indicator:** 3px `#a5b4fc` bar on left edge of active item.
**Active item background:** `rgba(255,255,255,0.12)`.

**Property switcher** (top of sidebar, below brand):
- Rounded card `rgba(255,255,255,0.07)` with `1px rgba(255,255,255,0.1)` border
- Indigo→purple gradient avatar square (28×28px, rounded 6px) showing property initial
- Property name (12px 600) + "Current property" label (10px, 40% opacity)
- Chevron on right

**Section labels:** 9px, 600 weight, uppercase, 35% opacity white.
**Nav items:** 12.5px, 500 weight. Icons at 13px.
**Badges:** orange `rgba(249,115,22,0.9)` for alert counts; indigo-tinted for plan badge.
**Upgrade badge:** orange→amber gradient pill.

**Brand wordmark:** "Intuitive Stay" — 15px, 700 weight, white, letter-spacing -0.4px.

## Topbar

White background, 54px tall, 1px `#e5e7eb` bottom border.
Left: page title (15px, 700, `#111827`) + property subtitle for property pages (11px, 500, `#9ca3af`).
Right: user display name (12px, 500, `#6b7280`) + indigo→purple avatar circle (32px) with initials.

## Content Area Background

`#f8fafc` (very light blue-grey, replaces pure white).

## Stat Cards (used on both dashboards)

White card, `border-radius: 12px`, `box-shadow: 0 1px 4px rgba(0,0,0,0.05)`.
**Left border:** 5px solid, colour varies by metric:
- GCS / primary metric → indigo `#6366f1`
- Properties / feedback → teal `#14b8a6`
- Alerts → orange `#f97316`
- Status / anticipation → purple `#8b5cf6`
- Recognition pillar → orange `#f97316`

**Label:** 10px, 600, uppercase, `letter-spacing: 0.07em`, `#9ca3af`.
**Value:** 28px, 800 weight, `letter-spacing: -1px`, coloured to match border.
**Sub-text:** 11px, 500, `#9ca3af`.

## Organisation Dashboard (`/`)

**Time range tabs** (7 days / 30 days / 6 months) above stat cards.
Tab bar: `background: #f3f4f6`, `border-radius: 8px`, 3px padding.
Active tab: white background, indigo text, subtle shadow.

**Stat cards row (3 columns):**
1. Portfolio GCS — indigo
2. Active Properties — teal
3. Open Alerts — orange

**GCS Over Time chart card:**
- White card, 12px radius, 18px padding
- Title: 14px 700, sub: 11px 500 `#9ca3af`
- Area chart: indigo `#6366f1` line (2.5px), gradient fill `rgba(99,102,241,0.2) → transparent`
- 120px tall chart area, `border-radius: 8px`

## Property Dashboard (`/properties/:id/dashboard`)

**Stat cards row (3 columns):**
1. GCS Score — indigo
2. Total Feedback — teal
3. Status — purple (shows "Approved ✓" or current status)

**Pillar Averages section:**
- Section label: 10px, 700, uppercase, `#9ca3af`
- 4-column grid, one card per pillar
- Each card: white, 12px radius, centred layout
- Pillar label: 10px 600 uppercase `#9ca3af`
- Progress bar: 6px tall, `#f3f4f6` background, coloured fill
- Score: 24px 800, coloured

| Pillar | Colour |
|---|---|
| Resilience | `#6366f1` indigo |
| Empathy | `#14b8a6` teal |
| Anticipation | `#8b5cf6` purple |
| Recognition | `#f97316` orange |

## Font Loading

Add Inter to the global HTML `<head>` in `app/root.tsx` or equivalent:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

Apply globally in the base CSS / Tailwind config:

```css
font-family: 'Inter', system-ui, sans-serif;
```

Or in `tailwind.config`:
```js
theme: { extend: { fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] } } }
```

## Files to Change

| File | Change |
|---|---|
| `apps/portal-web/src/components/app-sidebar.tsx` | Full sidebar redesign — dark gradient bg, Inter, new nav styles |
| `apps/portal-web/src/routes/_portal.index.tsx` | Org dashboard — new stat cards, chart card, time-range tabs |
| `apps/portal-web/src/routes/_portal.properties.$propertyId.dashboard.tsx` | Property dashboard — new stat cards, pillar cards |
| `apps/portal-web/vite.config.ts` or root layout | Add Inter font import |
| `apps/portal-web/tailwind.config` (or equivalent) | Set Inter as default sans font |

## Out of Scope

- Insights, Feedback, Advanced Insights, QR Codes, Members pages — unchanged in this phase
- Dark mode toggle — existing system-level dark mode remains but this redesign targets light mode
- Admin dashboard — unchanged in this phase
