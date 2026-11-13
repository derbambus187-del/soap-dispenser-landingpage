# Plan: 3-in-1 Seifenspender Landingpage

## Ziel
Statische, mehrsprachige (DE/EN) Produkt-Landingpage für einen Seifenspender mit 3 Ausgabemodi (Seife, Rasierschaum, Zahnpasta).

---

## Tech-Stack Empfehlung

| Layer | Wahl | Begründung |
|-------|------|------------|
| Framework | **Astro** | Optimal für statische Content-Seiten, exzellentes i18n, Islands-Architektur für Interaktivität, schnelle Builds |
| Styling | **Tailwind CSS** | Utility-first, kleine Bundle-Größe, Dark-Mode-Support |
| Icons | **Lucide React** / **Tabler Icons** | Leichtgewichtig, konsistent |
| Deployment | **Vercel** oder **Cloudflare Pages** | Kostenlos, CI/CD, Edge-Netzwerk, Preview-Deployments |
| Domain | Eigene Domain + automatisches HTTPS | Professioneller Auftritt |

---

## Seitenstruktur (Sitemap)

```
/ (Root → redirect zu /de oder /en basierend auf Accept-Language)
├── /de
│   ├── /                    # Startseite
│   ├── /produkt             # Produkt-Detailseite
│   ├── /funktionen          # Features/USPs
│   ├── /anwendung           # How-to / Use Cases
│   ├── /faq                 # Häufige Fragen
│   └── /kontakt             # Kontakt / Bestell-Link
└── /en
    ├── /                    # Home
    ├── /product             # Product Detail
    ├── /features            # Features
    ├── /usage               # Usage Guide
    ├── /faq                 # FAQ
    └── /contact             # Contact / Order
```

---

## Komponenten-Architektur

```
src/
├── components/
│   ├── ui/                  # Wiederverwendbare UI-Primitiven
│   │   ├── Button.astro
│   │   ├── Card.astro
│   │   ├── Icon.astro
│   │   ├── Badge.astro
│   │   └── Section.astro
│   ├── layout/
│   │   ├── Header.astro     # Navigation, Sprachumschalter
│   │   ├── Footer.astro     # Links, Social, Impressum
│   │   └── Layout.astro     # Base-Layout mit Slot
│   ├── home/
│   │   ├── Hero.astro       # Headline, CTA, Produktbild
│   │   ├── ValueProp.astro  # 3 Spalten: Seife/Schaum/Zahnpasta
│   │   ├── DemoVideo.astro  # Video-Player oder GIF
│   │   ├── TechSpecs.astro  # Technische Daten
│   │   └── TrustBar.astro   # Logos, Zertifikate, Bewertungen
│   ├── product/
│   │   ├── Gallery.astro    # Bilder-Slider/Grid
│   │   ├── ModeSelector.astro # Interaktiv: 3 Modi demonstrieren
│   │   └── SpecsTable.astro # Tabelle
│   └── shared/
│       ├── LanguageSwitcher.astro
│       ├── SEO.astro        # Meta-Tags, OpenGraph, JSON-LD
│       └── CookieBanner.astro (optional)
├── content/
│   ├── config.ts            # Collection-Config für i18n
│   ├── de/                  # Deutsche Inhalte (Markdown/JSON)
│   │   ├── home.json
│   │   ├── product.json
│   │   ├── features.json
│   │   ├── faq.json
│   │   └── contact.json
│   └── en/                  # Englische Inhalte
├── i18n/
│   ├── ui.ts                # UI-Strings (Buttons, Labels, ARIA)
│   ├── routes.ts            # Route-Übersetzungen (/produkt ↔ /product)
│   └── utils.ts             # Helfer: getLocale, translatePath, etc.
├── layouts/
│   └── BaseLayout.astro
├── pages/
│   ├── index.astro          # Redirect basierend auf Sprache
│   ├── [lang]/
│   │   ├── index.astro      # Home
│   │   ├── product.astro
│   │   ├── features.astro
│   │   ├── usage.astro
│   │   ├── faq.astro
│   │   └── contact.astro
│   └── rss.xml.js           # Optional: Blog/News Feed
├── styles/
│   └── global.css           # Tailwind @import, Custom Properties
└── scripts/
    └── mode-demo.ts         # Client-side JS für Modus-Demo (Island)
```

---

## Inhaltliche Bausteine (Content Model)

### Homepage (`home.json`)
```json
{
  "hero": {
    "headline": "Ein Spender. Drei Möglichkeiten.",
    "subheadline": "Seife, Rasierschaum & Zahnpasta – hygienisch, platzsparend, smart.",
    "ctaPrimary": { "label": "Jetzt entdecken", "href": "/de/produkt" },
    "ctaSecondary": { "label": "Video ansehen", "href": "#demo" }
  },
  "valueProps": [
    { "icon": "droplet", "title": "Flüssigseife", "desc": "Für Hände & Körper" },
    { "icon": "cloud", "title": "Rasierschaum", "desc": "Perfekt für Nassrasur" },
    { "icon": "sparkles", "title": "Zahnpasta", "desc": "Dosiert & sauber" }
  ],
  "techSpecs": [
    { "label": "Kapazität", "value": "3 × 300 ml" },
    { "label": "Material", "value": "ABS + Edelstahl" },
    { "label": "Batterie", "value": "6 Monate (USB-C)" },
    { "label": "Montage", "value": "Kleben oder Schrauben" }
  ]
}
```

### Produktseite (`product.json`)
- Galerie (3–5 Bilder: Front, Side, Open, Mounted, Lifestyle)
- Interaktiver Modus-Wähler (Tabs: Seife | Schaum | Zahnpasta)
- Technische Spezifikationen (Tabelle)
- Lieferumfang
- Kompatibilität (Nachfüllpacks)

### Features (`features.json`)
- Hygienisch (berührungslos, separierte Kammern)
- Platzsparend (1 Gerät statt 3)
- Nachhaltig (Nachfüllsystem, weniger Plastik)
- Smart (Sensor, Dosiermenge einstellbar, App-ready)
- Design (Preise, Farben, Badezimmer-Ästhetik)

### FAQ (`faq.json`)
- Wie wird nachgefüllt?
- Welche Marken passen?
- Batterielaufzeit?
- Wandmontage ohne Bohren?
- Garantie / Rückgabe?
- Versandländer?

---

## Mehrsprachigkeit (i18n) – Umsetzung

1. **Routing**: `[lang]` Prefix in Astro (`src/pages/[lang]/...`)
2. **Content Collections**: Pro Sprache eigene Collection (`content/de`, `content/en`)
3. **UI-Strings**: Zentrale Map in `src/i18n/ui.ts`
4. **Language Switcher**: Im Header, speichert Präferenz in `localStorage`
5. **SEO**: `hreflang`-Tags, `lang`-Attribut, übersetzte Meta-Daten
6. **Redirect**: Root `/` → erkennt `Accept-Language` → 302 zu `/de` oder `/en`

---

## Interaktivität (Islands)

| Feature | Umsetzung | Hydration |
|---------|-----------|-----------|
| Modus-Demo (Produktseite) | Tabs mit Animation, zeigt Dosiermenge, Viskosität | `client:visible` |
| Video-Player | `<video>` mit Poster, Lazy-Load | `client:idle` |
| Smooth Scroll | CSS `scroll-behavior: smooth` | Kein JS |
| Language Switcher | Client-seitig für Instant-Switch | `client:load` |
| Cookie Banner | Optional, DSGVO-konform | `client:load` |

---

## SEO & Performance

- **Meta-Tags**: Title, Description, OpenGraph, Twitter Card pro Seite/Sprache
- **Structured Data**: `Product`, `FAQPage`, `Organization` (JSON-LD)
- **Sitemap**: Auto-generiert via `@astrojs/sitemap`
- **Images**: `@astrojs/image` → WebP/AVIF, responsive `srcset`, Lazy-Load
- **Fonts**: Self-hosted Variable Fonts (z.B. Inter, Space Grotesk), `font-display: swap`
- **Critical CSS**: Inline via Astro `<style is:global>`
- **Lighthouse-Ziel**: ≥ 95 Performance, 100 Accessibility, 100 Best Practices, 100 SEO

---

## Barrierefreiheit (a11y)

- Semantisches HTML5 (`<header>`, `<main>`, `<section>`, `<footer>`)
- Farbkontrast ≥ 4.5:1 (WCAG AA)
- Fokus-Outline sichtbar (`:focus-visible`)
- ARIA-Labels für Icon-Buttons, Tabs, Language-Switcher
- `alt`-Texte für alle Bilder (lokalisiert)
- Skip-Link "Zum Hauptinhalt"
- Reduzierte Bewegung (`prefers-reduced-motion`)

---

## Analytics & Tracking (DSGVO-konform)

- **Plausible** oder **Umami** (Cookie-frei, EU-gehostet)
- Event-Tracking: CTA-Klicks, Modus-Demo-Interaktion, Video-Play, Scroll-Depth
- Kein Google Analytics ohne Consent

---

## CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run build
      - run: npm run test  # a11y, html-validate, link-check
      - uses: actions/upload-artifact@v4
        with: { name: dist, path: dist/ }

  deploy-preview:
    needs: build
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with: { name: dist, path: dist/ }
      - uses: amondnet/vercel-action@v25
        with: { vercel-token: ${{ secrets.VERCEL_TOKEN }}, vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}, vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }, vercel-args: '--prod=false' }

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with: { name: dist, path: dist/ }
      - uses: amondnet/vercel-action@v25
        with: { vercel-token: ${{ secrets.VERCEL_TOKEN }}, vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}, vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }, vercel-args: '--prod=true' }
```

---

## Projekt-Setup (Init-Befehle)

```bash
# 1. Projekt anlegen
npm create astro@latest soap-dispenser-landingpage -- --template minimal --typescript strict
cd soap-dispenser-landingpage

# 2. Dependencies
npm install -D tailwindcss @astrojs/tailwind @astrojs/sitemap @astrojs/image astro-i18next
npm install lucide-astro clsx tailwind-merge

# 3. Tailwind init
npx tailwindcss init -p

# 4. Configs anpassen (astro.config.mjs, tailwind.config.mjs, tsconfig.json)
```

---

## Offene Fragen / Entscheidungen nötig

| # | Frage | Empfehlung |
|---|-------|------------|
| 1 | Produktbilder vorhanden? | Falls nicht: Placeholder-Plan + KI-Generierung (Midjourney) oder 3D-Render (Spline/Blender) budgetieren |
| 2 | Video-Demo vorhanden? | Falls nicht: Kurzes Looped-GIF als Fallback, später durch echtes Video ersetzen |
| 3 | Nachfüllpacks separat verkaufen? | Wenn ja: "Shop"-Link → externer Shopify/WooCommerce Link |
| 4 | Rechtliche Seiten (Impressum, Datenschutz, AGB)? | Generator nutzen (z.B. eRecht24), als `/de/impressum` etc. einbauen |
| 5 | Farbvarianten des Spenders? | Wenn ja: Farbwähler auf Produktseite + entsprechende Bilder |
| 6 | B2B-Anfragen (Hotels, Fitnessstudios)? | Separates Kontaktformular "B2B/Partnerschaften" |

---

## Nächste Schritte (Implementation Order)

1. **Setup**: Astro + Tailwind + i18n Config
2. **Base Layout**: Header, Footer, Language Switcher, SEO-Komponente
3. **Content Collections**: Schemas + DE/EN Content-Dateien anlegen
4. **Homepage**: Hero, ValueProps, TechSpecs, TrustBar
5. **Produktseite**: Galerie, Modus-Demo (Island), Specs, Lieferumfang
6. **Features / Usage / FAQ / Kontakt**: Statische Seiten aus Content
7. **Polish**: a11y-Audit, Lighthouse, Cross-Browser-Test
8. **Deploy**: Vercel/Cloudflare verbunden, Domain konfiguriert
9. **Analytics**: Plausible/Umami eingebunden
10. **Handover**: README mit Content-Pflege-Anleitung für Marketing

---

## Datei-Output

Plan gespeichert unter: `.kilo/plans/1794211429508-3in1-soap-dispenser-landingpage.md`