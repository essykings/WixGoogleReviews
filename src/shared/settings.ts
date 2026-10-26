// Everything the owner can customise, saved from the dashboard and read by the site widget.
// Pure, so it is unit-tested. Stored as one JSON text; anything missing or of the wrong type falls back to the default,
// so adding a setting later never breaks an older save.

import { limitsFor, type Plan } from './plan';
import { cleanColors, type Colors } from './colors';

export const TEMPLATES = ['carousel', 'slider', 'grid', 'masonry', 'list'] as const;
export type Template = (typeof TEMPLATES)[number];

export const SORTS = ['newest', 'oldest', 'highest', 'lowest'] as const;
export type SortKey = (typeof SORTS)[number];

export const COUNTS = [5, 10, 20, 50, 100] as const;
export const RADII = ['none', 'small', 'medium', 'large'] as const;
export type Radius = (typeof RADII)[number];
export const TEXT_SIZES = ['small', 'medium', 'large'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const COLUMNS = [2, 3, 4] as const;
export const DATE_FORMATS = ['monthDayYear', 'dayMonthYear', 'iso', 'numeric', 'relative'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];
export const NAME_FORMATS = ['full', 'first', 'firstInitial', 'initials'] as const;
export type NameFormat = (typeof NAME_FORMATS)[number];
export const ALIGNS = ['left', 'center', 'right'] as const;
export type Align = (typeof ALIGNS)[number];
export const TEXT_FORMATS = ['readMore', 'full', 'truncate'] as const;
export type TextFormat = (typeof TEXT_FORMATS)[number];
export const BADGE_STYLES = ['name', 'image', 'stars'] as const;
export type BadgeStyle = (typeof BADGE_STYLES)[number];
export const FONTS = ['clean', 'site'] as const;
export type Font = (typeof FONTS)[number];
export const HEADER_LAYOUTS = ['top', 'side'] as const;
export type HeaderLayout = (typeof HEADER_LAYOUTS)[number];
export const MAX_HIDDEN = 300;
export const TRUNCATE_MIN = 40;
export const TRUNCATE_MAX = 400;

export interface Show {
  /** The title line. */
  header: boolean;
  /** Use the business name as the title (a title the owner typed always wins). */
  placeName: boolean;
  /** The business photo beside the title. */
  placeImage: boolean;
  /** The stars and the score in the header. */
  rating: boolean;
  /** The "1,219 Google reviews" text next to them. */
  count: boolean;
  stars: boolean;
  text: boolean;
  date: boolean;
  name: boolean;
  /** Make the reviewer's name a link to the review on Google. */
  nameLink: boolean;
  photo: boolean;
  reply: boolean;
  link: boolean;
  leaveButton: boolean;
  /** A check mark meaning the review comes from Google. */
  badge: boolean;
  arrows: boolean;
  dots: boolean;
}

export interface Settings {
  template: Template;
  /** Where the business header sits: above the reviews, or at their left. */
  headerLayout: HeaderLayout;
  /** Reviews the owner chose to hide (their IDs). */
  hiddenIds: string[];
  count: number;
  /** Star ratings to include (Pro). */
  stars: number[];
  /** Keywords: keep only reviews with one of these (Pro). */
  include: string[];
  /** Keywords: drop reviews with any of these (Pro). */
  exclude: string[];
  sort: SortKey;
  onlyWithText: boolean;
  columns: number;
  autoplay: boolean;
  show: Show;
  headerTitle: string;
  /** '' means the default colour. */
  colors: Colors;
  /** No background at all, so the widget sits on the site's own background. */
  transparent: boolean;
  radius: Radius;
  textSize: TextSize;
  font: Font;
  dateFormat: DateFormat;
  nameFormat: NameFormat;
  align: Align;
  textFormat: TextFormat;
  /** Characters shown before "Read more" (or the cut). */
  truncate: number;
  badgeStyle: BadgeStyle;
}

export const DEFAULT_SETTINGS: Settings = {
  template: 'carousel',
  headerLayout: 'top',
  hiddenIds: [],
  count: 10,
  stars: [1, 2, 3, 4, 5],
  include: [],
  exclude: [],
  sort: 'newest',
  onlyWithText: false,
  columns: 3,
  autoplay: false,
  show: { header: true, placeName: true, placeImage: true, rating: true, count: true, stars: true, text: true, date: true, name: true, nameLink: false, photo: true, reply: false, link: false, leaveButton: false, badge: false, arrows: true, dots: true },
  headerTitle: '',
  colors: { background: '', card: '', text: '', star: '', button: '' },
  transparent: false,
  radius: 'medium',
  textSize: 'medium',
  font: 'clean',
  dateFormat: 'monthDayYear',
  nameFormat: 'full',
  align: 'left',
  textFormat: 'readMore',
  truncate: 120,
  badgeStyle: 'name',
};

const MAX_KEYWORDS = 20;
const MAX_KEYWORD_LENGTH = 40;
export const MAX_TITLE_LENGTH = 60;

function oneOf<T extends readonly unknown[]>(list: T, v: unknown, fallback: T[number]): T[number] {
  return list.includes(v as T[number]) ? (v as T[number]) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

export function cleanKeywords(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const raw of v) {
    if (typeof raw !== 'string') continue;
    const w = raw.trim().slice(0, MAX_KEYWORD_LENGTH);
    if (w && !out.some((o) => o.toLowerCase() === w.toLowerCase())) out.push(w);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}

export function cleanIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const raw of v) {
    if (typeof raw === 'string' && raw && raw.length <= 200 && !out.includes(raw)) out.push(raw);
    if (out.length >= MAX_HIDDEN) break;
  }
  return out;
}

export function normalizeSettings(raw: unknown): Settings {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
  const d = DEFAULT_SETTINGS;
  const show = r.show && typeof r.show === 'object' ? r.show : {};
  const stars = Array.isArray(r.stars) ? [...new Set(r.stars.filter((n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5))].sort() as number[] : d.stars;
  const truncate = Number.isFinite(r.truncate) ? Math.max(TRUNCATE_MIN, Math.min(TRUNCATE_MAX, Math.round(r.truncate))) : d.truncate;
  return {
    template: oneOf(TEMPLATES, r.template, d.template),
    headerLayout: oneOf(HEADER_LAYOUTS, r.headerLayout, d.headerLayout),
    hiddenIds: cleanIds(r.hiddenIds),
    count: COUNTS.includes(r.count) ? r.count : d.count,
    stars: stars.length ? stars : d.stars,
    include: cleanKeywords(r.include),
    exclude: cleanKeywords(r.exclude),
    sort: oneOf(SORTS, r.sort, d.sort),
    onlyWithText: bool(r.onlyWithText, d.onlyWithText),
    columns: COLUMNS.includes(r.columns) ? r.columns : d.columns,
    autoplay: bool(r.autoplay, d.autoplay),
    show: {
      header: bool(show.header, d.show.header),
      placeName: bool(show.placeName, d.show.placeName),
      placeImage: bool(show.placeImage, d.show.placeImage),
      rating: bool(show.rating, d.show.rating),
      count: bool(show.count, d.show.count),
      stars: bool(show.stars, d.show.stars),
      text: bool(show.text, d.show.text),
      date: bool(show.date, d.show.date),
      name: bool(show.name, d.show.name),
      nameLink: bool(show.nameLink, d.show.nameLink),
      photo: bool(show.photo, d.show.photo),
      reply: bool(show.reply, d.show.reply),
      link: bool(show.link, d.show.link),
      leaveButton: bool(show.leaveButton, d.show.leaveButton),
      badge: bool(show.badge, d.show.badge),
      arrows: bool(show.arrows, d.show.arrows),
      dots: bool(show.dots, d.show.dots),
    },
    headerTitle: typeof r.headerTitle === 'string' ? r.headerTitle.trim().slice(0, MAX_TITLE_LENGTH) : d.headerTitle,
    colors: cleanColors(r.colors),
    transparent: bool(r.transparent, d.transparent),
    radius: oneOf(RADII, r.radius, d.radius),
    textSize: oneOf(TEXT_SIZES, r.textSize, d.textSize),
    font: oneOf(FONTS, r.font, d.font),
    dateFormat: oneOf(DATE_FORMATS, r.dateFormat, d.dateFormat),
    nameFormat: oneOf(NAME_FORMATS, r.nameFormat, d.nameFormat),
    align: oneOf(ALIGNS, r.align, d.align),
    textFormat: oneOf(TEXT_FORMATS, r.textFormat, d.textFormat),
    truncate,
    badgeStyle: oneOf(BADGE_STYLES, r.badgeStyle, d.badgeStyle),
  };
}

export function encodeSettings(s: Settings): string {
  return JSON.stringify(s);
}

/** Tolerant: anything that is not our format reads as the defaults, never as a crash. */
export function decodeSettings(json: unknown): Settings {
  if (typeof json !== 'string' || !json) return normalizeSettings({});
  try {
    return normalizeSettings(JSON.parse(json));
  } catch {
    return normalizeSettings({});
  }
}

/** True if these settings use anything the Free plan does not include. */
export function usesProFeatures(s: Settings): boolean {
  return s.count > limitsFor('free').maxReviews || s.stars.length < 5 || s.include.length > 0 || s.exclude.length > 0 || s.sort !== 'newest';
}

/**
 * Whether a save needs the plan read again with a fresh login (slow: about 5 seconds). Only a site that looks Free AND is saving
 * Pro options needs it, because that is the one case where a just-upgraded plan could be read as stale and wrongly stripped.
 */
export function needsFreshPlanForSave(firstRead: Plan, s: Settings): boolean {
  return firstRead === 'free' && usesProFeatures(s);
}

/** Free: 5 reviews, no star, keyword or sort options. Everything else is kept. Pro and unknown keep everything. */
export function stripProFeatures(s: Settings, plan: Plan): Settings {
  if (plan !== 'free') return s;
  return { ...s, count: Math.min(s.count, limitsFor('free').maxReviews), stars: [1, 2, 3, 4, 5], include: [], exclude: [], sort: 'newest' };
}

export function parsePlan(v: unknown): Plan {
  return v === 'free' || v === 'pro' ? v : 'unknown';
}
