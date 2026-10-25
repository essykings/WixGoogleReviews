// The review wall, as plain HTML + CSS strings: five templates (carousel, slider, grid, masonry, list), the owner's colours,
// and show/hide and format options. One renderer for the live site, the Editor and the dashboard preview, used inside a
// shadow root so the site's CSS cannot break it. Pure, so it is unit-tested. All reviewer and owner text is escaped.

import { onColor, resolveColors } from './colors';
import type { NameFormat, Radius, Settings, TextSize } from './settings';
import type { Review } from './reviews';
import { formatCount, formatDateStyle, formatRating, resolveLanguage, wordingFor } from './wording';

export interface WallData {
  placeId: string;
  placeName: string;
  /** The business photo link, or ''. */
  placeImageUrl: string;
  rating: number | null;
  totalReviews: number | null;
  reviews: Review[];
}

/** The base text size in pixels. Wix gives a widget a tiny default, so the size is always set explicitly. */
export const TEXT_PX: Record<TextSize, number> = { small: 13, medium: 15, large: 17 };
export const RADIUS_PX: Record<Radius, number> = { none: 0, small: 6, medium: 12, large: 20 };

/** An owner reply longer than this gets a "Read more" button (the reply shows 3 lines until then). */
export const LONG_REPLY = 140;
/** Grid, masonry and list show this many first, then a "Show more" button adds the same number again. */
export const PAGE_SIZE = 6;
/** More dots than this and they are left out (the arrows still work). */
export const MAX_DOTS = 10;

export const FONT_STACK = '"Roboto", "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** "Ann Lee" becomes "AL"; one word gives one letter; nothing gives "?". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const first = Array.from(words[0])[0] ?? '?';
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? '') : '';
  return (first + last).toLocaleUpperCase();
}

/** How a reviewer's name is shown: "Ann Lee", "Ann", "Ann L." or "AL". */
export function formatName(name: string, format: NameFormat): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length || format === 'full') return name.trim();
  if (format === 'initials') return initialsOf(name);
  if (format === 'first' || words.length === 1) return words[0];
  return `${words[0]} ${Array.from(words[words.length - 1])[0].toLocaleUpperCase()}.`;
}

/** One of 8 fixed colours, chosen from the name so the same person always gets the same one. */
export function avatarTone(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return `c${h % 8}`;
}

/** The first `max` characters, cut at a word where one is close, with an ellipsis. Short text comes back unchanged. */
export function cutText(text: string, max: number): { short: string; cut: boolean } {
  const chars = Array.from(text);
  if (chars.length <= max) return { short: text, cut: false };
  let head = chars.slice(0, max).join('');
  const space = head.lastIndexOf(' ');
  if (space > head.length * 0.75) head = head.slice(0, space);
  return { short: `${head.trimEnd()}…`, cut: true };
}

// The star: a 15 x 15 five-point shape. The symbol's viewBox has a little spare room so the outline is never clipped.
const STAR_PATH = 'M7.5,0l-2,5h-5l4,3.5l-2,6l5-3.5l5,3.5l-2-6l4-3.5h-5L7.5,0z';

/** Five drawn stars: solid for the rating, outlined for the rest. */
function stars(n: number): string {
  const full = Math.max(0, Math.min(5, Math.round(n)));
  return Array.from({ length: 5 }, (_, i) => `<svg class="s ${i < full ? 'on' : 'off'}" viewBox="0 0 24 24" aria-hidden="true"><use href="#st"/></svg>`).join('');
}

function badge(label: string): string {
  return `<span class="bdg" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#bd"/></svg></span>`;
}

function avatar(r: Review, name: string, withBadge: string): string {
  const ini = escapeHtml(initialsOf(name));
  const tone = avatarTone(name);
  if (r.photoUrl) {
    return `<span class="av ${tone}" data-ini="${ini}"><img src="${escapeHtml(r.photoUrl)}" alt="" width="40" height="40" loading="lazy" referrerpolicy="no-referrer">${withBadge}</span>`;
  }
  return `<span class="av ini ${tone}" data-ini="${ini}" aria-hidden="true">${ini}${withBadge}</span>`;
}

function card(r: Review, s: Settings, lang: string, index: number, paged: boolean, now: number): string {
  const w = wordingFor(lang);
  const name = r.author || w.anonymous;
  const date = formatDateStyle(r.publishedAt, lang, s.dateFormat, now);
  const showReply = s.show.reply && !!r.replyText;
  const mark = s.show.badge ? badge(w.fromGoogle) : '';

  const nameHtml = s.show.name ? `<div class="author">${escapeHtml(formatName(name, s.nameFormat))}${s.badgeStyle === 'name' ? mark : ''}</div>` : '';
  const meta = `${nameHtml}${s.show.date && date ? `<div class="date">${escapeHtml(date)}</div>` : ''}`;
  const av = s.show.photo ? avatar(r, name, s.badgeStyle === 'image' ? mark : '') : '';
  const who = av || meta ? `<div class="who">${av}${meta ? `<div class="meta">${meta}</div>` : ''}</div>` : '';
  const starsHtml = s.show.stars ? `<div class="stars" role="img" aria-label="${escapeHtml(w.starsLabel(formatRating(r.rating, lang)))}">${stars(r.rating)}${s.badgeStyle === 'stars' ? mark : ''}</div>` : '';

  let text = '';
  let truncated = false;
  if (s.show.text) {
    if (!r.text) text = `<p class="text none">${escapeHtml(w.noText)}</p>`;
    else {
      const { short, cut } = s.textFormat === 'full' ? { short: r.text, cut: false } : cutText(r.text, s.truncate);
      truncated = cut && s.textFormat === 'readMore';
      text = truncated
        ? `<p class="text"><span class="t-short">${escapeHtml(short)}</span><span class="t-full">${escapeHtml(r.text)}</span></p>`
        : `<p class="text">${escapeHtml(short)}</p>`;
    }
  }
  const reply = showReply ? `<div class="reply"><div class="reply-title">${escapeHtml(w.ownerReply)}</div><p>${escapeHtml(r.replyText)}</p></div>` : '';
  const more = truncated || (showReply && r.replyText.length > LONG_REPLY)
    ? `<button type="button" class="more" data-more aria-expanded="false" data-more-label="${escapeHtml(w.readMore)}" data-less-label="${escapeHtml(w.readLess)}">${escapeHtml(w.readMore)}</button>`
    : '';
  const link = s.show.link && r.url ? `<div class="foot"><a class="link" href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(w.viewOnGoogle)}</a></div>` : '';
  const extra = paged && index >= PAGE_SIZE ? ' hidden data-extra' : '';
  return `<li class="card"${extra}>${who}${starsHtml}${text}${reply}${more}${link}</li>`;
}

export function buildWall(data: WallData, s: Settings, langRaw: string, now = Date.now()): { html: string; css: string } {
  const lang = resolveLanguage(langRaw);
  const w = wordingFor(lang);
  const rowTemplate = s.template === 'carousel' || s.template === 'slider';
  const paged = !rowTemplate;

  const titleText = s.headerTitle || (s.show.placeName && data.placeName ? data.placeName : w.title);
  const title = s.show.header ? `<div class="title">${escapeHtml(titleText)}</div>` : '';
  const image = s.show.placeImage && data.placeImageUrl ? `<img class="pimg" src="${escapeHtml(data.placeImageUrl)}" alt="" width="56" height="56" loading="lazy" referrerpolicy="no-referrer">` : '';
  const scoreHtml = s.show.rating && data.rating != null
    ? `<span class="stars" role="img" aria-label="${escapeHtml(w.starsLabel(formatRating(data.rating, lang)))}">${stars(data.rating)}</span> <strong>${escapeHtml(formatRating(data.rating, lang))}</strong>`
    : '';
  const countHtml = s.show.count && data.totalReviews != null
    ? `<span class="count">${escapeHtml(w.googleCount(formatCount(data.totalReviews, lang), data.totalReviews === 1))}</span>`
    : '';
  const sum = scoreHtml || countHtml ? `<div class="sum">${scoreHtml}${scoreHtml && countHtml ? ' ' : ''}${countHtml}</div>` : '';
  const button = s.show.leaveButton && data.placeId
    ? `<a class="btn" href="https://search.google.com/local/writereview?placeid=${encodeURIComponent(data.placeId)}" target="_blank" rel="noopener noreferrer">${escapeHtml(w.leaveReview)}</a>`
    : '';
  const left = `${image}${title || sum ? `<div class="ht">${title}${sum}</div>` : ''}`;
  const header = left || button ? `<header class="head"><div class="hl">${left}</div>${button}</header>` : '';

  const cards = data.reviews.map((r, i) => card(r, s, lang, i, paged, now)).join('');
  const label = escapeHtml(w.title);
  let body: string;
  if (rowTemplate) {
    const prev = s.show.arrows ? `<button type="button" class="nav prev" data-dir="-1" aria-label="${escapeHtml(w.previous)}" disabled>‹</button>` : '';
    const next = s.show.arrows ? `<button type="button" class="nav next" data-dir="1" aria-label="${escapeHtml(w.next)}">›</button>` : '';
    const dots = s.show.dots ? `<div class="dots" role="group" aria-label="${label}"></div>` : '';
    body = `<div class="wrap">${prev}<ul class="track" tabindex="0" aria-label="${label}">${cards}</ul>${next}</div>${dots}`;
  } else {
    const showMore = data.reviews.length > PAGE_SIZE ? `<div class="morewrap"><button type="button" class="btn ghost" data-showmore>${escapeHtml(w.showMore)}</button></div>` : '';
    body = `<ul class="flow" aria-label="${label}">${cards}</ul>${showMore}`;
  }
  const defs = `<svg class="defs" aria-hidden="true" focusable="false"><symbol id="st" viewBox="-0.7 -0.7 15.4 15.4"><path d="${STAR_PATH}" stroke-linejoin="round"/></symbol><symbol id="bd" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="#1a73e8"/><path d="M7.4 12.6l3 3 6.2-6.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol></svg>`;
  const cols = s.template === 'grid' || s.template === 'masonry' ? ` cols-${s.columns}` : '';
  const auto = rowTemplate && s.autoplay ? ' data-autoplay="1"' : '';
  const html = `<section class="gr t-${s.template}${cols} al-${s.align}"${auto} aria-label="${label}">${defs}${header}${body}</section>`;
  return { html, css: wallCss(s) };
}

export function wallCss(s: Settings): string {
  const c = resolveColors(s.colors);
  const pad = s.transparent ? 4 : 20;
  return `
:host { display: block; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
.defs { position: absolute; width: 0; height: 0; overflow: hidden; }
.gr { --gr-bg: ${s.transparent ? 'transparent' : c.background}; --gr-card: ${c.card}; --gr-text: ${c.text}; --gr-star: ${c.star}; --gr-btn: ${c.button}; --gr-btn-on: ${onColor(c.button)};
  --gr-r: ${RADIUS_PX[s.radius]}px; --gr-cols: ${s.columns};
  --gr-muted: color-mix(in srgb, var(--gr-text) 60%, var(--gr-card)); --gr-line: color-mix(in srgb, var(--gr-text) 14%, var(--gr-card));
  --gr-soft: color-mix(in srgb, var(--gr-text) 7%, var(--gr-card)); --gr-off: color-mix(in srgb, var(--gr-text) 24%, var(--gr-card));
  font-family: ${s.font === 'site' ? 'inherit' : FONT_STACK}; font-size: ${TEXT_PX[s.textSize]}px; line-height: 1.5; color: var(--gr-text); background: var(--gr-bg);
  border-radius: var(--gr-r); padding: ${pad}px; width: 100%; container-type: inline-size; }
.head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 16px; margin: 0 0 16px; }
.hl { display: flex; align-items: center; gap: 14px; min-width: 0; }
.ht { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pimg { width: 56px; height: 56px; object-fit: cover; border-radius: max(4px, calc(var(--gr-r) * 0.5)); flex: none; background: var(--gr-card); }
.title { font-weight: 700; font-size: 1.1em; line-height: 1.25; overflow-wrap: anywhere; }
.sum { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sum .s { width: 1.45em; height: 1.45em; }
.count { font-weight: 600; }
.stars { display: inline-flex; align-items: center; gap: 1px; line-height: 1; white-space: nowrap; }
.s { width: 1.1em; height: 1.1em; flex: none; stroke-linejoin: round; }
.s.on { fill: var(--gr-star); stroke: var(--gr-star); stroke-width: 0.9; }
.s.off { fill: none; stroke: var(--gr-star); stroke-width: 1.1; }
.bdg { display: inline-flex; flex: none; width: 1.05em; height: 1.05em; margin-left: 5px; vertical-align: -0.15em; }
.bdg svg { width: 100%; height: 100%; }
.av .bdg { position: absolute; right: -3px; bottom: -3px; margin: 0; width: 17px; height: 17px; background: #fff; border-radius: 50%; }
.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 8px 18px; border-radius: max(4px, calc(var(--gr-r) * 0.5)); border: 1px solid transparent; background: var(--gr-btn); color: var(--gr-btn-on); font: inherit; font-weight: 700; font-size: 0.92em; text-decoration: none; cursor: pointer; }
.btn:hover { opacity: 0.88; }
.btn.ghost { background: transparent; color: var(--gr-text); border-color: var(--gr-line); }
.btn.ghost:hover { background: var(--gr-card); opacity: 1; }
.wrap { position: relative; display: flex; align-items: stretch; gap: 8px; }
.track { list-style: none; margin: 0; padding: 4px; display: flex; gap: 16px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; flex: 1 1 auto; min-width: 0; -webkit-overflow-scrolling: touch; }
.track::-webkit-scrollbar { display: none; }
@media (prefers-reduced-motion: no-preference) { .track { scroll-behavior: smooth; } }
.card { background: var(--gr-card); border-radius: calc(var(--gr-r) * 0.85); padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.t-carousel .card { flex: 0 0 min(320px, 86%); scroll-snap-align: start; }
.t-slider .track { max-width: 780px; margin: 0 auto; }
.t-slider .card { flex: 0 0 100%; scroll-snap-align: center; align-items: center; text-align: center; padding: 24px 28px; gap: 12px; }
.t-slider .who { justify-content: center; flex-direction: column; text-align: center; }
.t-slider .text { font-size: 1.1em; }
.t-slider .reply { text-align: left; width: 100%; }
.flow { list-style: none; margin: 0; padding: 0; --n: var(--gr-cols); }
.t-grid .flow { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 16px; align-items: stretch; }
.t-masonry .flow { column-count: var(--n); column-gap: 16px; }
.t-masonry .card { break-inside: avoid; margin: 0 0 16px; }
.t-list .flow { display: flex; flex-direction: column; gap: 12px; }
.morewrap { display: flex; justify-content: center; margin-top: 18px; }
.who { display: flex; align-items: center; gap: 10px; min-width: 0; }
.meta { min-width: 0; }
.av { position: relative; width: 40px; height: 40px; border-radius: 50%; flex: none; display: grid; place-items: center; font-weight: 600; font-size: 0.9em; color: #fff; background: var(--gr-off); }
.av img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 50%; }
.av.ini.c0 { background: #2563eb; } .av.ini.c1 { background: #7c3aed; } .av.ini.c2 { background: #db2777; } .av.ini.c3 { background: #c2410c; }
.av.ini.c4 { background: #0f766e; } .av.ini.c5 { background: #15803d; } .av.ini.c6 { background: #475569; } .av.ini.c7 { background: #a16207; }
.author { font-weight: 700; overflow-wrap: anywhere; line-height: 1.3; }
.date { color: var(--gr-muted); font-size: 0.87em; }
.card .stars .s { width: 1.3em; height: 1.3em; }
.text { margin: 0; white-space: pre-line; overflow-wrap: anywhere; }
.text.none { color: var(--gr-muted); font-style: italic; }
.t-full { display: none; }
.card.open .t-short { display: none; }
.card.open .t-full { display: inline; }
.card.open .reply p { -webkit-line-clamp: unset; display: block; }
.more { align-self: flex-start; background: none; border: 0; padding: 4px 0; min-height: 32px; color: var(--gr-muted); font: inherit; font-weight: 600; cursor: pointer; }
.more:hover, .link:hover { color: var(--gr-text); }
.t-slider .more { align-self: center; }
.reply { background: var(--gr-soft); border-radius: max(6px, calc(var(--gr-r) * 0.6)); padding: 8px 10px; font-size: 0.93em; text-align: left; }
.reply-title { font-weight: 700; color: var(--gr-muted); margin-bottom: 2px; }
.reply p { margin: 0; white-space: normal; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.foot { margin-top: auto; padding-top: 4px; }
.link { color: var(--gr-muted); font-size: 0.88em; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.nav { flex: 0 0 auto; align-self: center; width: 40px; height: 40px; border-radius: 50%; border: 0; background: transparent; color: var(--gr-text); font-size: 30px; line-height: 1; cursor: pointer; }
.nav:disabled { opacity: 0.3; cursor: default; }
.nav:hover:not(:disabled) { background: var(--gr-card); }
.dots { display: flex; justify-content: center; gap: 0; margin-top: 8px; }
.dot { width: 24px; height: 24px; border: 0; background: none; padding: 0; display: grid; place-items: center; cursor: pointer; }
.dot::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--gr-off); transition: transform .15s; }
.dot[aria-current="true"]::before { background: var(--gr-text); transform: scale(1.25); }
.track.has-open { align-items: flex-start; }
.al-center .head { flex-direction: column; justify-content: center; text-align: center; }
.al-center .hl { flex-direction: column; text-align: center; }
.al-center .sum { justify-content: center; }
.al-center .card { text-align: center; align-items: center; }
.al-center .who { justify-content: center; }
.al-center .more { align-self: center; }
.al-right .head { justify-content: flex-end; text-align: right; flex-direction: row-reverse; }
.al-right .hl { flex-direction: row-reverse; text-align: right; }
.al-right .sum { justify-content: flex-end; }
.al-right .card { text-align: right; align-items: flex-end; }
.al-right .who { flex-direction: row-reverse; text-align: right; }
.al-right .more { align-self: flex-end; }
button:focus-visible, a:focus-visible, .track:focus-visible { outline: 3px solid var(--gr-btn); outline-offset: 2px; }
@container (max-width: 760px) { .flow { --n: min(var(--gr-cols), 2); } }
@container (max-width: 520px) { .flow { --n: 1; } .nav { display: none; } .t-carousel .card { flex-basis: 88%; } .t-slider .card { padding: 20px 16px; } }
.note { margin: 12px 0 0; padding: 8px 12px; border-radius: 8px; background: #fff7e0; color: #6b4e00; font-size: 0.85em; }
`;
}

const sampleReview = (id: string, author: string, rating: number, text: string, days: number, reply = ''): Review => ({
  id, author, rating, text, publishedAt: new Date(Date.UTC(2026, 9, 25) - days * 86_400_000).toISOString(), language: 'en', photoUrl: '', replyText: reply, replyAt: '', url: '',
});

/** What the owner sees until a place is saved: made-up reviews, clearly labelled. */
export const SAMPLE: WallData = {
  placeId: '',
  placeName: 'Your business',
  placeImageUrl: '',
  rating: 4.8,
  totalReviews: 128,
  reviews: [
    sampleReview('s1', 'Alex Morgan', 5, 'Friendly team and quick service. We will definitely be back!', 3, 'Thank you Alex, see you soon!'),
    sampleReview('s2', 'Sam Patel', 5, 'Great value and a lovely atmosphere. Highly recommended to anyone nearby. The staff went out of their way to make us feel welcome and the whole visit was easy from start to finish.', 9),
    sampleReview('s3', 'Jordan Kim', 4, 'Really good overall. Parking can be tricky but it is worth it.', 17),
    sampleReview('s4', 'Taylor Brooks', 5, 'Exceeded my expectations. Professional and on time.', 24, 'Thanks Taylor, we really appreciate it.'),
    sampleReview('s5', 'Chris Nguyen', 3, 'Decent service, a bit slow at lunchtime.', 31),
    sampleReview('s6', 'Maria Garcia', 5, 'Fantastic experience from start to finish. The team was friendly and went above and beyond.', 40),
    sampleReview('s7', 'Lee Johnson', 4, 'Good quality and fair prices.', 52),
    sampleReview('s8', 'Dana White', 5, 'Would recommend to anyone. Five stars.', 66),
  ],
};

export const EDITOR_NOTE = 'Example reviews. Save your Place ID on the app page in your dashboard to see your real Google reviews here.';
