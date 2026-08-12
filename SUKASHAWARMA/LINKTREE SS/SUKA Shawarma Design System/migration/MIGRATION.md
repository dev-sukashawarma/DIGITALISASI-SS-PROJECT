# Rebrand Migration Guide — Option B (Full Upgrade)

Pull `colors_and_type.css` into your repo as a sibling of `style.css`, link it
**first** in every `<head>`, and gradually migrate components.

This gives you the warm SUKA palette **plus** the type scale + Plus Jakarta
Sans body font, with the legacy `style.css` still working unmodified.

> **Repo:** [`irsyadtawakal-ssn/FormOrder_SS`](https://github.com/irsyadtawakal-ssn/FormOrder_SS)
> **Time estimate:** 15–20 minutes for steps 1–4, deploy is `git push`.

---

## Files I've prepared

Both are in `migration/` in this design-system project, ready to copy over:

| File here | Goes to in your repo |
|---|---|
| `migration/colors_and_type.css` | `assets/css/colors_and_type.css` (NEW file) |
| `migration/style.optionB.css` | `assets/css/style.css` (OVERWRITES existing) |

**The key trick:** `colors_and_type.css` defines the new tokens (`--brand`,
`--fg1`, `--font-sans`, full type scale, …) **plus a "Legacy aliases" block
at the bottom** that maps your old variable names (`--ink`, `--brand-bg`,
`--accent-ink`, `--font` …) to the new palette. The existing `style.css`
keeps working unmodified.

`style.optionB.css` is byte-for-byte identical to your original — except its
`:root { … }` block is removed (those tokens now live in
`colors_and_type.css`).

---

## Step 1 — Copy the two files into your repo

```bash
# Inside your FormOrder_SS repo
cp /path/to/migration/colors_and_type.css   assets/css/colors_and_type.css
cp /path/to/migration/style.optionB.css     assets/css/style.css
```

---

## Step 2 — Update every HTML `<head>`

Link `colors_and_type.css` **before** `style.css`. Order matters — the new
file MUST load first so its tokens are available when `style.css` references
them.

**Root-level pages** (`index.html`, `menu.html`, `checkout.html`,
`order.html`):

```html
<link rel="stylesheet" href="assets/css/colors_and_type.css" />
<link rel="stylesheet" href="assets/css/style.css" />
```

**Admin pages** (`admin/index.html`, `admin/orders.html`, `admin/menu.html`,
`admin/outlets.html`, `admin/login.html`, `admin/reports.html`,
`admin/settings.html`, `admin/users.html`, `admin/import.html`):

```html
<link rel="stylesheet" href="../assets/css/colors_and_type.css" />
<link rel="stylesheet" href="../assets/css/style.css" />
```

Replace the existing single `<link rel="stylesheet" href="…/style.css" />`
line with these two.

---

## Step 3 — Update the PWA theme color

One find-replace across every HTML file:

```html
<!-- before -->
<meta name="theme-color" content="#ff4d4f">

<!-- after -->
<meta name="theme-color" content="#f29744">
```

Also `manifest.json`:

```json
{
  "theme_color": "#f29744"
}
```

This is what the browser uses for the address bar / splash screen / status
bar tint on installed PWAs.

---

## Step 4 — (Optional) Add Google Fonts preconnect

The new `colors_and_type.css` `@import`s fonts via the CSS `@import` rule,
which works but blocks rendering ~80ms longer than the `<link>` equivalent.
For best performance, also add this to each HTML `<head>`, near the top:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

Skip this if you don't want to touch every file again — fonts still load.

---

## Step 5 — Deploy

```bash
git add assets/css/ *.html admin/*.html manifest.json
git status                # sanity-check
git commit -m "Rebrand: warm SUKA palette + Plus Jakarta Sans body font"
git push
```

Your `.cpanel.yml` auto-deploys on push to `order.sukashawarma.com`.

---

## What you get after these 5 steps

- **Colors:** the entire customer + admin app re-skins to the warm orange /
  brown / cream palette automatically — no component touched. Legacy aliases
  do the work.
- **Type:** Plus Jakarta Sans replaces the iOS system stack — feels more
  modern and slightly more Indonesian.
- **A new token vocabulary** available alongside the legacy one:
  `--fg1`, `--fg-muted`, `--brand-soft`, `--font-display`, `--space-*`,
  `--radius-pill`, full semantic statuses (`--ok`, `--warn`, `--info`,
  `--danger`). Use these in any *new* code you write.

---

## Sanity test before pushing

```bash
# Run a quick local server (Python ships with this)
python3 -m http.server 8000

# Then open
# http://localhost:8000/index.html
# http://localhost:8000/admin/login.html
```

Things to spot-check:

- [ ] Topbar logo color is orange, not red
- [ ] "Bayar Sekarang" button is orange, not red
- [ ] "+" add buttons are orange
- [ ] Background is white/cream, not grey
- [ ] Body text reads as dark brown (`#400a07`), not pure black
- [ ] PWA install prompt (if any) uses the new orange
- [ ] No console errors about missing font files

If anything still shows red, search the repo for hardcoded hex values:

```bash
# These are the legacy red/orange literals — should be ZERO matches after migration
grep -rn "#ff4d4f\|#e83e40\|#ff8c42\|#ff6b00" --include="*.html" --include="*.css" --include="*.js"
```

---

## Gradual migration (months 2+)

You don't have to touch the existing `style.css` at all. But when you
**edit** a component, swap its variables to the new names:

| Old (legacy alias) | New (preferred) | Why |
|---|---|---|
| `color: var(--ink)` | `color: var(--fg1)` | Semantic — "primary foreground" |
| `color: var(--ink2)` | `color: var(--fg2)` | Semantic — "secondary foreground" |
| `color: var(--muted)` | `color: var(--fg-muted)` | Consistent prefix |
| `color: var(--faint)` | `color: var(--fg-faint)` | Consistent prefix |
| `background: var(--brand-bg)` | `background: var(--brand-soft)` | Reads as a tint, not a "bg" |
| `border: 1px solid var(--line2)` | `border: 1px solid var(--line-2)` | Numeric suffix style |
| `font-family: var(--font)` | `font-family: var(--font-sans)` | Distinguishes from `--font-display` / `--font-mono` |
| `--accent-ink` | `var(--accent)` | The brown is the accent, no separate ink |

Once everything is migrated, delete the **"Legacy aliases"** block at the
bottom of `colors_and_type.css`. No rush — leaving it doesn't hurt anything.

---

## New things you can do once migrated

### Use the display font

```html
<h1 style="font-family: var(--font-display); color: var(--brand-ink); font-size: 32px">
  SUKA Shawarma
</h1>
```

Reserve for splash screens, marketing, big stats — NOT body UI.

### Use the semantic statuses

Instead of inventing tinted backgrounds per status pill, use the four
semantic pairs:

```css
.my-success-banner { background: var(--ok-soft);     color: var(--ok); }
.my-warn-banner    { background: var(--warn-soft);   color: var(--warn); }
.my-info-banner    { background: var(--info-soft);   color: var(--info); }
.my-danger-banner  { background: var(--danger-soft); color: var(--danger); }
```

### Use the spacing scale

```css
padding: var(--space-3) var(--space-4);
gap: var(--space-2);
```

Sticking to the 4-point scale keeps rhythm consistent with the rest of the
app.

---

## Rollback plan

If anything breaks badly after deploy, you have two escape hatches:

1. **Quickest:** revert the commit — `git revert HEAD && git push`.
2. **Per-file:** restore `assets/css/style.css` from `git show HEAD~1:assets/css/style.css > assets/css/style.css`, delete `assets/css/colors_and_type.css`, and roll back the HTML `<link>` lines. The PWA theme-color change is safe to leave.

The migration is purely additive — no existing data, behaviour, or markup
changes — so the blast radius is contained to "the app looks like before."

---

## Questions to ask before pushing to prod

- Do you have a way to test the **PWA install + offline** flow? `sw.js` will
  cache the new CSS; users on the old version will see the new palette only
  after the SW updates (next visit, usually).
- Do you want to **bump the SW cache version** so users get the new CSS
  immediately? Edit `sw.js`'s cache name (e.g. `suka-v2` → `suka-v3`).
- Any **printed receipts** that use the brand color? Check the print CSS in
  `style.css` (search for `@media print`).
- Any **WhatsApp notification templates** that reference the brand color in
  HTML emails or rich previews? Update separately.

---

## Need a one-shot apply package?

If you'd rather get a ZIP with **every file pre-patched** (HTML heads
updated, theme-color updated, manifest updated), say the word. I'll generate
it so you only have to `git add . && git commit && git push`.
