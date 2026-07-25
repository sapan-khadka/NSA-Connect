# NSA Connect — Design System & Cursor Instructions

This is the single source of truth for restyling NSA Connect. Paste relevant sections directly into
Cursor as instructions, or drop the whole file into the repo as `DESIGN_SYSTEM.md` and reference it
in prompts ("follow DESIGN_SYSTEM.md" / "@DESIGN_SYSTEM.md").

Primary reference: a CRM dashboard ("Plan"). Secondary patterns borrowed selectively from a
booking-app calendar, a fintech account list, an analytics dashboard, and an AI-agent product —
each restyled into this system, never copied wholesale.

---

## 0. Instructions for Cursor (read this first)

You are restyling an existing React + TypeScript + Tailwind CSS app (NSA Connect, a student-org
management platform). Follow these rules on every component you touch:

1. **Never introduce a new color without checking Section 2.** If a component currently uses an
   ad-hoc hex or a Tailwind default (`bg-blue-500`, `text-yellow-600`, etc.), replace it with the
   token from this system.
2. **Color = status only.** Outside of the tokens in Section 2, color must never be decorative.
   If you're tempted to give a card/icon/avatar a color "to make it pop," don't — use the neutral
   surface token instead.
3. **One primary button per view.** If a screen already has a primary (solid black) button, every
   other button on that screen is `secondary` (outlined) or `ghost` (no border).
4. **Depth comes from surface contrast, not shadows.** Use `bg-surface` vs `bg-page` + a 1px
   `border-border` hairline. Do not add `shadow-md`/`shadow-lg` to cards unless explicitly asked.
5. **Reuse existing components before creating new ones.** Check `/components/ui` (or equivalent)
   for an existing Card, Badge, Button, Tabs, etc. before writing a new one from scratch.
6. **When unsure between two patterns described below, pick the plainer one.** Restraint is the
   design goal — if it looks like it needs a comment explaining why it's colorful, don't ship it.
7. Ask for a screenshot / current component code before restyling if none is provided — don't
   guess at existing class names.

---

## 1. Typography

```js
// tailwind.config.js
fontFamily: {
  sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
},
```

Install: `Inter` via `next/font/google` or `@fontsource/inter` (weights 400, 500, 600, 700).

| Role | Class | Size | Weight |
|---|---|---|---|
| Page title (h1) | `text-[28px] font-bold` | 28–32px | 700 |
| Section title (h2) | `text-xl font-semibold` | 20px | 600 |
| Stat number | `text-[28px] font-bold tabular-nums` | 28–32px | 700 |
| Tab / nav label | `text-sm font-medium` | 14px | 500 |
| Body / list title | `text-sm font-semibold` | 14–15px | 600 |
| Secondary / meta | `text-xs text-ink-secondary` | 12–13px | 400 |
| Muted / eyebrow | `text-xs text-ink-muted uppercase tracking-wide` | 12px | 400 |

Rules: only weights **400** and **600/700** appear anywhere. No 300, no italics. Line-height 1.4–1.5
(`leading-normal` / `leading-relaxed`), never `leading-tight` on body text.

---

## 2. Color tokens

```js
// tailwind.config.js — extend, don't replace
theme: {
  extend: {
    colors: {
      page: '#FFFFFF',          // app content background
      canvas: '#F0F0F0',        // outer page wrapper behind the white app shell
      surface: {
        DEFAULT: '#F7F7F8',     // cards, stat tiles, active-nav pill
        hover: '#EFEFF1',
      },
      border: {
        DEFAULT: '#E5E5E8',
        strong: '#D4D4D8',
      },
      ink: {
        primary: '#111113',
        secondary: '#6B6B70',
        muted: '#9CA3AF',
      },
      accent: {
        DEFAULT: '#0A0A0B',     // primary buttons, active states — black, not brand-teal
      },
      status: {
        successBg: '#DCFCE7', successText: '#15803D',
        warningBg: '#FEF3C7', warningText: '#92650A',
        dangerBg:  '#FEE2E2', dangerText:  '#B91C1C',
        infoBg:    '#DBEAFE', infoText:    '#1D4ED8',
      },
    },
    borderRadius: {
      card: '12px',
      shell: '20px',   // outer canvas-wrapper radius
    },
  },
}
```

**Accent choice for this repo:** `accent.DEFAULT` / `primary` are **black** (`#0A0A0B`) globally.
Do not mix teal and black accents.

**Status color mapping (use consistently across the whole app):**
| Meaning | Background | Text |
|---|---|---|
| Paid / Active / Confirmed / In stock | `status-successBg` | `status-successText` |
| Pending / In progress / Awaiting review | `status-warningBg` | `status-warningText` |
| Overdue / Idle-negative / At risk | `status-dangerBg` | `status-dangerText` |
| Informational / neutral highlight | `status-infoBg` | `status-infoText` |

---

## 3. Layout shell

- Wrap the entire app in a `bg-canvas` outer container with the actual app content sitting in a
  `bg-page rounded-shell` panel with ~16–24px margin — gives the "elevated white card on gray
  canvas" feel instead of edge-to-edge white.
- Sidebar fixed ~240–260px. Content area fluid with `max-w` constraint on very wide screens.
- Base spacing unit: 4px grid. Card padding `p-5` (20px). Gaps between cards `gap-4` (16px).
- Corner radius: `rounded-card` (12px) on cards/buttons, `rounded-full` on avatars/pill badges/
  segmented-toggle active states.

---

## 4. Core components

### Sidebar nav item
```tsx
// active
<div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
  <Icon className="h-4 w-4 text-ink-primary" />
  <span className="text-sm font-semibold text-ink-primary">Members</span>
</div>
// inactive
<div className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-surface-hover">
  <Icon className="h-4 w-4 text-ink-secondary" />
  <span className="text-sm font-medium text-ink-secondary">Events</span>
</div>
```
No colored left-border. No colored icon. The gray pill background is the only active-state signal.

### Buttons
```tsx
// primary — one per view max
<button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">
  Invite member
</button>
// secondary
<button className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-primary hover:bg-surface-hover">
  Download report
</button>
// ghost / icon-only
<button className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary hover:bg-surface-hover">
  <Icon className="h-4 w-4" />
</button>
```

### Stat tile (flat, with optional progress bar)
```tsx
<div className="rounded-card bg-surface p-5">
  <div className="mb-1 flex items-center gap-1.5 text-xs text-ink-muted">
    <Icon className="h-3.5 w-3.5" />
    <span>Docs owed</span>
  </div>
  <p className="text-[28px] font-bold text-ink-primary tabular-nums">5</p>
  {/* optional progress bar variant */}
  <div className="mt-3 h-1.5 w-full rounded-full bg-border">
    <div className="h-1.5 rounded-full bg-accent" style={{ width: '18%' }} />
  </div>
</div>
```
Never give different tiles different background tints. All stat tiles in a row share the same
`bg-surface`. Only the progress-bar fill (and only when semantically "at risk") may go
`bg-status-dangerText` red — everything else stays neutral.

### Status badge
```tsx
<span className="inline-flex items-center gap-1 rounded-full bg-status-successBg px-2.5 py-0.5 text-xs font-medium text-status-successText">
  <CheckIcon className="h-3 w-3" />
  Paid
</span>
```

### Segmented toggle (view switch)
```tsx
<div className="inline-flex rounded-lg bg-surface p-0.5">
  <button className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-ink-primary shadow-none">Weekly</button>
  <button className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-secondary">Monthly</button>
  <button className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-secondary">Yearly</button>
</div>
```

### Underline tabs (page-level navigation)
```tsx
<div className="flex gap-6 border-b border-border">
  <button className="border-b-2 border-ink-primary pb-2 text-sm font-semibold text-ink-primary">Documents</button>
  <button className="border-b-2 border-transparent pb-2 text-sm font-medium text-ink-secondary">Notes</button>
</div>
```

### Table / list row (documents, members, transactions)
```tsx
<div className="flex items-center justify-between border-b border-border py-4">
  <div className="flex items-center gap-3">
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface">
      <FileIcon className="h-4 w-4 text-ink-secondary" />
    </div>
    <div>
      <p className="text-sm font-semibold text-ink-primary">Constitution.pdf</p>
      <p className="text-xs text-ink-muted">Doc.pdf · 1.2MB · 02 Jan, 2025</p>
    </div>
  </div>
  <div className="flex items-center gap-2">
    <button className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white">
      <CheckIcon className="h-3.5 w-3.5" />
    </button>
    <button className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink-primary">
      <XIcon className="h-3.5 w-3.5" />
    </button>
    <button className="flex h-8 w-8 items-center justify-center text-ink-muted">
      <MoreVerticalIcon className="h-4 w-4" />
    </button>
  </div>
</div>
```

### Avatar (neutral, never rainbow)
```tsx
<div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-xs font-medium text-ink-secondary">
  MR
</div>
```
Every avatar fallback uses the same `bg-surface` tone. Do not hash a color per user.

### Binary toggle (active/inactive on cards)
```tsx
<button role="switch" aria-checked={isActive}
  className={`h-6 w-11 rounded-full transition-colors ${isActive ? 'bg-accent' : 'bg-border'}`}>
  <span className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform ${isActive ? 'translate-x-5' : ''}`} />
</button>
```

### Tag pill (category label — max 2–3 tones total app-wide)
```tsx
<span className="rounded-full bg-status-warningBg px-2.5 py-0.5 text-xs font-medium text-status-warningText">Team</span>
<span className="rounded-full bg-status-successBg px-2.5 py-0.5 text-xs font-medium text-status-successText">Meeting</span>
```

### AI activity feed entry (for the 4 planned AI features)
```tsx
<div className="flex gap-3 border-b border-border py-4">
  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-surface">
    <SparkleIcon className="h-4 w-4 text-ink-secondary" />
  </div>
  <div className="flex-1">
    <p className="text-sm text-ink-primary">
      <span className="font-semibold">Drafted</span> event checklist for Maghe Sankranti 2026.
    </p>
    <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
      <SparkleIcon className="h-3 w-3" /> AI assistant · 2 min ago
    </p>
  </div>
</div>
```

### AI status banner (for the chatbot / RAG assistant, dashboard placement)
```tsx
<div className="flex items-center justify-between rounded-card bg-ink-primary px-6 py-4 text-white">
  <div className="flex items-center gap-3">
    <span className="relative flex h-2 w-2">
      <span className="absolute h-2 w-2 animate-ping rounded-full bg-white/60" />
      <span className="relative h-2 w-2 rounded-full bg-white" />
    </span>
    <span className="text-xs font-medium uppercase tracking-wide text-white/70">Assistant · live</span>
    <span className="text-sm">Answering 2 questions from the group chat right now</span>
  </div>
  <div className="flex gap-2">
    <span className="rounded-full bg-white/10 px-3 py-1 text-xs">Summarizing minutes</span>
  </div>
</div>
```
Flat dark fill — no gradient, no purple mesh. This is the one place a fully dark (not gray) surface
is intentional, to visually separate "live AI state" from static content.

### Calendar (if/when an events-calendar view is built)
- Neutral 7-column month grid, muted gray digits, no fill on empty cells.
- Event-day indicator: a 4px dot under the date, colored by event *type* only
  (general = `ink-muted`, board = `accent`, deadline = `status-dangerText`) — max 3 dot colors.
- Selected/today: solid `bg-accent` filled circle, white digit.
- Day timeline: hourly hairlines, event blocks as `bg-surface` cards with a **3px left border**
  in the type color (`border-l-[3px] border-l-accent`) — never a fully colored block.

### Monochrome trend chart
- Single hue ramp (light → dark) by magnitude, not one color per category.
- In-bar or in-line data labels instead of a separate legend where possible.
- Tooltip: solid `bg-ink-primary text-white rounded-lg px-3 py-2 text-xs`, anchored to a dot marker.

---

## 5. Page-by-page mapping (what to actually change first)

| Page | Priority changes |
|---|---|
| Home dashboard | Flatten stat row to `bg-surface` tiles, no icon circles; add AI banner once chatbot ships; restyle Memories header per Section 4 eyebrow pattern |
| Members | Neutral avatars (already planned), status dot + text instead of colored pills, restyle "Needs attention / People" toggle as a segmented control |
| Events | Underline tabs for Details/Budget/Tasks; binary toggle for active/inactive; tag pills capped at 2–3 tones |
| Treasury | Account-row pattern (icon square + name/subtitle + right-aligned balance); monochrome trend chart with tooltip |
| Documents | Table row pattern from Section 4 exactly as shown |
| Sidebar (global) | Convert active state to full-row gray pill, remove any colored left-border |
| AI features (all 4) | Use the activity-feed entry pattern for output; use the AI banner pattern on Home once the chatbot is live |

---

## 6. Pre-ship checklist

- [ ] No color used purely for decoration — every non-neutral color maps to a status in Section 2.
- [ ] All stat tiles in any single row share one background tone.
- [ ] Avatars are one neutral tone app-wide, not hashed per user.
- [ ] Exactly one solid/primary button visible per screen.
- [ ] Cards use surface-contrast + hairline border, not `shadow-md`/`shadow-lg`.
- [ ] Badges/tags use only the 4 status pairs in Section 2 — no new hex added ad hoc.
- [ ] Typography uses only weights 400/600/700, Inter, and the scale in Section 1.
- [ ] Any new chart uses a single hue ramp, not default multi-color library output.
