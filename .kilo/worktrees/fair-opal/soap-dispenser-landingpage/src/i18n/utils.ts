export const LOCALES = ['de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'de';

export const ROUTE_MAP: Record<string, Record<string, string>> = {
  de: {
    '/': '/',
    '/produkt': '/produkt',
    '/funktionen': '/funktionen',
    '/anwendung': '/anwendung',
    '/faq': '/faq',
    '/kontakt': '/kontakt',
    '/impressum': '/impressum',
    '/datenschutz': '/datenschutz',
  },
  en: {
    '/': '/',
    '/product': '/product',
    '/features': '/features',
    '/usage': '/usage',
    '/faq': '/faq',
    '/contact': '/contact',
    '/impressum': '/impressum',
    '/datenschutz': '/datenschutz',
  },
};

export function getLocale(pathname: string): Locale {
  const parts = pathname.split('/').filter(Boolean);
  const first = parts[0];
  if (first === 'en') return 'en';
  return 'de';
}

export function getAlternatePath(pathname: string, targetLocale: Locale): string {
  const current = getLocale(pathname);
  if (current === targetLocale) return pathname || '/';
  const stripped = pathname.replace(/^\/(de|en)/, '');
  const clean = stripped === '' ? '/' : stripped;
  return `/${targetLocale}${clean === '/' ? '' : clean}`;
}

export function isExternalLink(href: string): boolean {
  return href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:');
}