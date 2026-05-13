# Pussikauppa → Shopify — exact UI clone

Source mirror: **https://pussikauppa.com/** (Frozen Norse v3 design)
Theme folder: `shopify-clone/`

## What got ported (1:1)

Verified against live site via web fetch.

### Header (sticky)
- Announce bar: "Ilmainen toimitus yli 100€" · "3–5 arkipäivän toimitus" · "Tukkualennukset saatavilla"
- Logo center (Pussi+Kauppa split with ice accent)
- Nav left, account + cart actions right
- Mobile: burger left, logo center, icons right
- Bootstrap offcanvas sidebar with 18+ block, full nav, referral CTA (-20%)
- Scroll snow particles
- Glass-blur + scrolled state shadow

### Homepage (in order)
1. **Hero** — image + "Suosituimmat tuotteet." / "Parhailla hinnoilla." gradient em + guarantee chip + delivery line + Kauppa + Tietoa meistä CTAs
2. **Stats ribbon** — 4 / 7 / 3–5 / 18+ with Finnish labels
3. **Popular products** — Shopify collection `frontpage` (8 products grid)
4. **Referral promo** — "Kerro kaverille — säästä -20%" full panel with 3-step explainer + dual badges
5. **Brands grid** — Oden's / White Fox / VELO / GREATEST (glass cards, brand icon, meta, tag chip, CTA arrow)
6. **How it works** — 3 steps with vertical connector line + Finnish copy
7. **CTA section** — "Sinun pussisi. Sinun valintasi." big black gradient + 2 CTAs
8. **Why us** — 3 glass cards with icons (Nopea toimitus, Premium-laatu, 100% toimitustakuu)
9. **Age bar** — 18+ badge + warning text

### Pages
- `/pages/about-us` — exact "Pussikauppa — laatu edellä. Aina." with stats, split, 6-card values grid, dark CTA
- `/pages/faq` — 4 sections × accordion (Tilaaminen, Toimitus, Tuotteet, Ikä ja turvallisuus) with all 11 Q&A from live site
- `/pages/contact-us` — 2-col form + contact info card with badge "Asiakaspalvelu ma–pe"
- `/products/*` — product detail with pack-size bundle picker (1/5/10/20/50/100 kpl), Finnish chips, USP rows with check icons, 3 tabs (Tuotekuvaus / Käyttöohjeet / Tuotetiedot), related products grid
- `/collections/*` — grid with same product cards
- `/cart` — full cart page
- `/search`, `/404`, `/blogs/*`

### Side cart drawer (FAB)
- 1:1 CSS port from `em-side-cart.css` (Arctic Nordic overrides intact)
- JS rewritten for Shopify cart.js endpoints
- Auto-open on add-to-cart (fetch + jQuery interceptors)
- Flash sale section (timer, discount tag, +button)
- Free-shipping progress bar
- "Ostoskorisi", "Pikatarjous", "päättyy", "Yhteensä", "Siirry kassalle" Finnish strings
- Swipe to close, ESC to close

### Footer
- "Ilmainen toimitus yli 100€" / "Lähetykset joka arkipäivä" / "Tukkualennukset saatavilla" top bar
- 4-col grid: Brand + 3 link cols (Kauppa, Tietoa, Yhteystiedot)
- Trust strip (Turvallinen maksu / Premium / Nopea / Asiakaspalvelu)
- Copyright + 18+ chip

---

# Folder

```
shopify-clone/
├─ INSTALL.md                  ← this file
├─ layout/theme.liquid
├─ templates/                  10 page types
├─ sections/                   17 sections (header, footer, hero, ribbon, brands, how, cta, why, age, referral, featured-collection, main-{product,collection,cart,about,faq,contact,page,search,list-collections,404})
├─ snippets/                   3 (cart-drawer, product-card, icon-check)
├─ assets/                     6 (theme.css, side-cart.css, side-cart.js, product-card.css, badges.css, theme.js)
├─ config/                     settings_schema.json + settings_data.json
├─ locales/                    en.default.json + fi.json
├─ _assets-from-live/          PowerShell scripts to download live images
└─ _seed/                      products.csv + collections.csv for bulk import
```

---

# INSTALL — step by step

## 1. Get a Shopify dev store
- Sign up at https://partners.shopify.com (free)
- "Stores" → "Add store" → "Development store"
- Open the admin

## 2. Download live images (recommended)
Open PowerShell in `shopify-clone/_assets-from-live/`:

```powershell
cd "C:\Users\srbd1\OneDrive\Desktop\pussi for shopify\shopify-clone\_assets-from-live"
./DOWNLOAD.ps1
./DOWNLOAD-products.ps1
```

This grabs:
- hero-2.png + hero2.png (hero desktop/mobile)
- ice.jpg, ice2.jpg, ice3.jpg (section background textures)
- odens-icon.png, whitefox-icon.png, velo-icon.png, greatest-icon.png (brand icons — live site .webp URLs 404, downloader pulls equivalent PNG from product pages)
- about.jpg, pouche.jpeg (about + how-it-works imagery)
- 7 product images (Oden's, 3× White Fox, 2× VELO, GREATEST)

Upload all to **Shopify Admin → Content → Files** (drag-drop the whole folder).

## 3. Import products + collections (one-click bulk seed)

In Shopify Admin:

- **Products → Import** → upload `_seed/products.csv`
- **Collections → Create / Import** → upload `_seed/collections.csv` (or manually create them)

Collections to create:
| Title | Handle |
|---|---|
| Frontpage | `frontpage` |
| Oden's | `odens` |
| White Fox | `white-fox` |
| VELO | `velo` |
| GREATEST | `greatest` |
| Flash sale | `flash-sale` |

After import: open each product → upload its image (from `_assets-from-live`) as the featured image.

## 4. Set up product metafields (controls badges, specs, tabs)

Settings → Custom data → Products → Add definition. Namespace `custom`:

| Key | Type | Used by |
|---|---|---|
| `nicotine_strength` | Single-line text | Product page chip + spec table  (e.g. "13.2mg") |
| `pouch_size` | Single-line text | Chip + table (e.g. "Slim 0.75g") |
| `pouches_per_can` | Integer | Chip + table (e.g. 20) |
| `strength_level` | Single-line text | Strong chip (e.g. "Extreme", "Vahva") |
| `format` | Single-line text | Spec table (e.g. "White Dry") |
| `tobacco_free` | Single-line text | Spec table |
| `usp_2` | Single-line text | Mid USP row on product page |
| `related_collection` | Single-line text | Handle of collection for "Saatat myös pitää" |
| `badge_top_seller` | Boolean | Product card "Suosittu" badge |
| `badge_new` | Boolean | "Uusi" badge |
| `badge_trending` | Boolean | "Trendaa" badge |
| `badge_better_price` | Boolean | "Parempi hinta" |
| `badge_favourite` | Boolean | "Suosikki" |
| `badge_flash_sale` | Boolean | "Flash" |
| `badge_hot_deal` | Boolean | "Kuuma diili" |
| `per_unit_label` | Single-line text | Optional per-unit price line |
| `usp_1`/`usp_2`/`usp_3` | Single-line text | Three USP rows on product page |

## 5. Create site pages

Online Store → Pages → Add page:

| Page title | Handle (used by URL) | Template suffix |
|---|---|---|
| Tietoa meistä | `about-us` | `about-us` |
| Yleiset kysymykset | `faq` | `faq` |
| Ota yhteyttä | `contact-us` | `contact-us` |

In the page editor → Template (right sidebar) → pick the matching suffix template.

## 6. Set up main menu

Navigation → Main menu (handle `main-menu`):
- Kauppa → `/collections/all`
- Tietoa meistä → `/pages/about-us`
- Yleiset kysymykset → `/pages/faq`
- Ota yhteyttä → `/pages/contact-us`

## 7. Upload theme

### Route A — Shopify Admin (no CLI):
1. Open `shopify-clone/`
2. Select 7 subfolders (assets, config, layout, locales, sections, snippets, templates) — **do NOT include _assets-from-live or _seed**
3. Zip them
4. Online Store → Themes → Add theme → Upload zip → Actions → Preview

### Route B — Shopify CLI (hot reload):
```powershell
npm install -g @shopify/cli @shopify/theme
cd "C:\Users\srbd1\OneDrive\Desktop\pussi for shopify\shopify-clone"
shopify theme dev --store=YOUR-DEV.myshopify.com
```

## 8. Configure in Customize

Online Store → Themes → Customize.

**Theme settings:**
- Favicon → upload `favicon.png` from your live site
- Free shipping threshold → 100
- Flash sale → enable, timer 15, discount 25, collection handle `flash-sale`

**Header section:**
- Logo → upload your logo

**Hero section** (home page):
- Desktop image → `hero-2.png`
- Mobile image → `hero2.png`

**Brands grid** (home page):
- Bg image → `ice3.jpg`
- Block 1 (Oden's) → Logo `odens-icon.png`
- Block 2 (White Fox) → Logo `whitefox-icon.png`
- Block 3 (VELO) → Logo `velo-icon.png`
- Block 4 (GREATEST) → Logo `greatest-icon.png`

**Featured collection (Suosituimmat pussit):**
- Bg image → `ice2.jpg`
- Collection → `frontpage`

**How it works:**
- Visual image → `pouche.jpeg`
- Bg image → `ice.jpg`

**About page** (open `/pages/about-us` in Customize):
- Split image → `about.jpg`

**Footer:**
- Email → `info@pussikauppa.com` (already default)

## 9. Locale + currency

- Settings → Markets → Primary market: Finland
- Settings → General → Store currency: EUR
- Online Store → Languages → Add Finnish → set as default

## 10. Publish

Online Store → Themes → Pussikauppa Clone → Actions → **Publish**.

---

# What's NOT included (as you asked)

- Payment gateway plugins (use Shopify Payments)
- Thank-you / order-status custom page (Shopify default)
- WooFunnels post-purchase upsells
- Crossdomain bridge, IAB escape, PYS
- PHP-only WC hooks (variation pill counts, contact form mailer — replaced with Shopify form)

# Known visual deltas to fix manually if you want exact match

| Live element | Shopify equivalent |
|---|---|
| `[products limit=8]` shortcode on home | Featured collection section pointing to `frontpage` collection |
| Per-product 1/5/10/20/50/100 kpl bundle pricing | Product variants (Pack size option) — already in CSV seed |
| `5 purkkiä = -3% / 10 = -5% / 50 = -7% / 100 = -10%` tukku auto-discount | Shopify Admin → Discounts → Automatic discount (Buy X qty get Y%) — manual setup, 4 rules |
| Referral cookie -20% applied at checkout | Shopify Admin → Discounts → Discount code/auto + a referral app (e.g. ReferralCandy) |
| Floating "20% OFF — Your discount is ready" intro popup | Add a simple promo modal section — not yet ported, can add if needed |

# Cost

| Item | Cost |
|---|---|
| Shopify Basic | ~29 €/mo (3-month $1 trial) |
| Theme | free (this folder) |
| Bundle/discount app | usually free or $0-15/mo |
| Domain | already owned |
| **Total launch** | **~30 €/mo** |
