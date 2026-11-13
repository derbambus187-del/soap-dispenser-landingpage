export const ui = {
  de: {
    nav: {
      home: 'Startseite',
      product: 'Produkt',
      features: 'Funktionen',
      usage: 'Anwendung',
      faq: 'FAQ',
      contact: 'Kontakt',
    },
    common: {
      language: 'Sprache',
      languageDe: 'Deutsch',
      languageEn: 'English',
      menu: 'Menü',
      close: 'Schließen',
      ctaPrimary: 'Jetzt entdecken',
      ctaSecondary: 'Video ansehen',
      learnMore: 'Mehr erfahren',
      back: 'Zurück',
      next: 'Weiter',
      skipToContent: 'Zum Hauptinhalt',
      cookieBanner: {
        title: 'Cookies & Datenschutz',
        message: 'Diese Website verwendet keine Tracking-Cookies. Für Analytics wird ein cookie-freies Tool (Plausible/Umami) eingesetzt, das nur mit您的 Einwilligung aktiviert wird.',
        accept: 'Akzeptieren',
        reject: 'Ablehnen',
        settings: 'Einstellungen',
      },
      theme: {
        light: 'Hell',
        dark: 'Dunkel',
        toggle: 'Thema wechseln',
      },
      product: {
        modes: {
          soap: 'Seife',
          foam: 'Rasierschaum',
          paste: 'Zahnpasta',
        },
        gallery: {
          alt: '3-in-1 Seifenspender – {mode}',
        },
        buy: 'Jetzt kaufen',
        refill: 'Nachfüllpack',
      },
    },
    meta: {
      siteName: '3-in-1 Seifenspender',
      siteDescription: 'Ein Spender. Drei Möglichkeiten. Seife, Rasierschaum & Zahnpasta – hygienisch, platzsparend, smart.',
    },
  },
  en: {
    nav: {
      home: 'Home',
      product: 'Product',
      features: 'Features',
      usage: 'Usage',
      faq: 'FAQ',
      contact: 'Contact',
    },
    common: {
      language: 'Language',
      languageDe: 'Deutsch',
      languageEn: 'English',
      menu: 'Menu',
      close: 'Close',
      ctaPrimary: 'Discover now',
      ctaSecondary: 'Watch video',
      learnMore: 'Learn more',
      back: 'Back',
      next: 'Next',
      skipToContent: 'Skip to main content',
      cookieBanner: {
        title: 'Cookies & Privacy',
        message: 'This website uses no tracking cookies. Analytics uses a cookie-free tool (Plausible/Umami) that is only activated with your consent.',
        accept: 'Accept',
        reject: 'Decline',
        settings: 'Settings',
      },
      theme: {
        light: 'Light',
        dark: 'Dark',
        toggle: 'Toggle theme',
      },
      product: {
        modes: {
          soap: 'Soap',
          foam: 'Shaving foam',
          paste: 'Toothpaste',
        },
        gallery: {
          alt: '3-in-1 soap dispenser – {mode}',
        },
        buy: 'Buy now',
        refill: 'Refill pack',
      },
    },
    meta: {
      siteName: '3-in-1 Soap Dispenser',
      siteDescription: 'One dispenser. Three options. Soap, shaving foam & toothpaste – hygienic, space-saving, smart.',
    },
  },
} as const;

export type UiStrings = typeof ui;

export function getUi(locale: string) {
  const l = (locale as 'de' | 'en') in ui ? (locale as 'de' | 'en') : 'de';
  return ui[l];
}