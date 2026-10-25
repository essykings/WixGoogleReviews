// Visitor-facing wording in the site's language, with English fallback.
// Owner-only messages (dashboard, Editor notes) are in English, in messages.ts.

export interface Wording {
  title: string;
  reviewsCount(count: string, isOne: boolean): string;
  starsLabel(rating: string): string;
  ownerReply: string;
  readMore: string;
  readLess: string;
  previous: string;
  next: string;
  viewOnGoogle: string;
  /** Shown when a review has no author name. */
  anonymous: string;
  /** Shown for a star-only review. */
  noText: string;
  leaveReview: string;
  showMore: string;
  /** "1,219 Google reviews" */
  googleCount(count: string, isOne: boolean): string;
  /** What the check mark means. */
  fromGoogle: string;
}

const WORDING: Record<string, Wording> = {
  en: {
    title: 'Google Reviews',
    reviewsCount: (c, one) => (one ? '1 review' : `${c} reviews`),
    starsLabel: (r) => `Rated ${r} out of 5`,
    ownerReply: 'Response from the owner',
    readMore: 'Read more',
    readLess: 'Read less',
    previous: 'Previous reviews',
    next: 'Next reviews',
    viewOnGoogle: 'View on Google',
    anonymous: 'A Google user',
    noText: 'No written review',
    leaveReview: 'Leave a review',
    showMore: 'Show more',
    googleCount: (c, one) => (one ? '1 Google review' : `${c} Google reviews`),
    fromGoogle: 'Review from Google',
  },
  es: {
    title: 'Reseñas de Google',
    reviewsCount: (c, one) => (one ? '1 reseña' : `${c} reseñas`),
    starsLabel: (r) => `Valoración: ${r} de 5`,
    ownerReply: 'Respuesta del propietario',
    readMore: 'Leer más',
    readLess: 'Leer menos',
    previous: 'Reseñas anteriores',
    next: 'Reseñas siguientes',
    viewOnGoogle: 'Ver en Google',
    anonymous: 'Un usuario de Google',
    noText: 'Sin reseña escrita',
    leaveReview: 'Escribir una reseña',
    showMore: 'Ver más',
    googleCount: (c, one) => (one ? '1 reseña de Google' : `${c} reseñas de Google`),
    fromGoogle: 'Reseña de Google',
  },
  fr: {
    title: 'Avis Google',
    reviewsCount: (c, one) => (one ? '1 avis' : `${c} avis`),
    starsLabel: (r) => `Noté ${r} sur 5`,
    ownerReply: 'Réponse du propriétaire',
    readMore: 'Lire la suite',
    readLess: 'Réduire',
    previous: 'Avis précédents',
    next: 'Avis suivants',
    viewOnGoogle: 'Voir sur Google',
    anonymous: 'Un utilisateur Google',
    noText: 'Aucun avis écrit',
    leaveReview: 'Laisser un avis',
    showMore: 'Voir plus',
    googleCount: (c, one) => (one ? '1 avis Google' : `${c} avis Google`),
    fromGoogle: 'Avis provenant de Google',
  },
  de: {
    title: 'Google-Bewertungen',
    reviewsCount: (c, one) => (one ? '1 Bewertung' : `${c} Bewertungen`),
    starsLabel: (r) => `Bewertet mit ${r} von 5`,
    ownerReply: 'Antwort des Inhabers',
    readMore: 'Mehr lesen',
    readLess: 'Weniger anzeigen',
    previous: 'Vorherige Bewertungen',
    next: 'Nächste Bewertungen',
    viewOnGoogle: 'Auf Google ansehen',
    anonymous: 'Ein Google-Nutzer',
    noText: 'Keine schriftliche Bewertung',
    leaveReview: 'Bewertung schreiben',
    showMore: 'Mehr anzeigen',
    googleCount: (c, one) => (one ? '1 Google-Bewertung' : `${c} Google-Bewertungen`),
    fromGoogle: 'Bewertung von Google',
  },
  pt: {
    title: 'Avaliações do Google',
    reviewsCount: (c, one) => (one ? '1 avaliação' : `${c} avaliações`),
    starsLabel: (r) => `Nota ${r} de 5`,
    ownerReply: 'Resposta do proprietário',
    readMore: 'Ler mais',
    readLess: 'Ler menos',
    previous: 'Avaliações anteriores',
    next: 'Próximas avaliações',
    viewOnGoogle: 'Ver no Google',
    anonymous: 'Um usuário do Google',
    noText: 'Sem avaliação escrita',
    leaveReview: 'Deixar uma avaliação',
    showMore: 'Ver mais',
    googleCount: (c, one) => (one ? '1 avaliação do Google' : `${c} avaliações do Google`),
    fromGoogle: 'Avaliação do Google',
  },
  it: {
    title: 'Recensioni Google',
    reviewsCount: (c, one) => (one ? '1 recensione' : `${c} recensioni`),
    starsLabel: (r) => `Valutato ${r} su 5`,
    ownerReply: 'Risposta del proprietario',
    readMore: 'Leggi tutto',
    readLess: 'Mostra meno',
    previous: 'Recensioni precedenti',
    next: 'Recensioni successive',
    viewOnGoogle: 'Vedi su Google',
    anonymous: 'Un utente Google',
    noText: 'Nessuna recensione scritta',
    leaveReview: 'Lascia una recensione',
    showMore: 'Mostra altro',
    googleCount: (c, one) => (one ? '1 recensione Google' : `${c} recensioni Google`),
    fromGoogle: 'Recensione di Google',
  },
  nl: {
    title: 'Google-reviews',
    reviewsCount: (c, one) => (one ? '1 review' : `${c} reviews`),
    starsLabel: (r) => `Beoordeeld met ${r} van 5`,
    ownerReply: 'Reactie van de eigenaar',
    readMore: 'Meer lezen',
    readLess: 'Minder lezen',
    previous: 'Vorige reviews',
    next: 'Volgende reviews',
    viewOnGoogle: 'Bekijken op Google',
    anonymous: 'Een Google-gebruiker',
    noText: 'Geen geschreven review',
    leaveReview: 'Schrijf een review',
    showMore: 'Meer tonen',
    googleCount: (c, one) => (one ? '1 Google-review' : `${c} Google-reviews`),
    fromGoogle: 'Review van Google',
  },
};

export const SUPPORTED_LANGUAGES = Object.keys(WORDING);

/** "fr-FR" becomes "fr"; unknown or empty becomes "en". */
export function resolveLanguage(lang: string | null | undefined): string {
  const base = (lang ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return base in WORDING ? base : 'en';
}

export function wordingFor(lang: string | null | undefined): Wording {
  return WORDING[resolveLanguage(lang)];
}

function numberFormat(lang: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(lang || 'en', options);
  } catch {
    return new Intl.NumberFormat('en', options);
  }
}

/** 4.6 becomes "4.6" (en) or "4,6" (fr). Always one decimal, like Google. */
export function formatRating(rating: number, lang: string): string {
  return numberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rating);
}

export function formatCount(count: number, lang: string): string {
  return numberFormat(lang, { maximumFractionDigits: 0 }).format(count);
}

export function formatDate(iso: string, lang: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  try {
    return new Date(t).toLocaleDateString(lang || 'en', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return new Date(t).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' });
  }
}

export type DateStyle = 'monthDayYear' | 'dayMonthYear' | 'iso' | 'numeric' | 'relative';

/** A review date in the owner's chosen style and the site's language. `now` is only for tests. */
export function formatDateStyle(iso: string, lang: string, style: DateStyle, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const date = new Date(t);
  const loc = (() => {
    try {
      return Intl.DateTimeFormat.supportedLocalesOf(lang || 'en').length ? lang || 'en' : 'en';
    } catch {
      return 'en';
    }
  })();
  if (style === 'iso') return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  if (style === 'numeric') return date.toLocaleDateString(loc, { year: 'numeric', month: '2-digit', day: '2-digit' });
  if (style === 'relative') {
    const days = Math.round((date.getTime() - now) / 86_400_000);
    const rtf = new Intl.RelativeTimeFormat(loc, { numeric: 'auto' });
    const abs = Math.abs(days);
    if (abs < 1) return rtf.format(0, 'day');
    if (abs < 7) return rtf.format(days, 'day');
    if (abs < 30) return rtf.format(Math.round(days / 7), 'week');
    if (abs < 365) return rtf.format(Math.round(days / 30), 'month');
    return rtf.format(Math.round(days / 365), 'year');
  }
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  if (style === 'dayMonthYear') {
    // Day first, whatever the language's usual order.
    const parts = new Intl.DateTimeFormat(loc, opts).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return `${get('day')} ${get('month')} ${get('year')}`;
  }
  // Month first.
  const parts = new Intl.DateTimeFormat(loc, opts).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('month')} ${get('day')}, ${get('year')}`;
}
