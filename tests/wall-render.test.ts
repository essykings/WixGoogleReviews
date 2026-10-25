import { describe, expect, it } from 'vitest';
import { normalizeSettings, TEMPLATES, type Settings } from '../src/shared/settings';
import { avatarTone, buildEmpty, buildWall, cutText, escapeHtml, formatName, initialsOf, MAX_DOTS, PAGE_SIZE, SAMPLE, type WallData } from '../src/shared/wall-render';
import { formatDateStyle, resolveLanguage, SUPPORTED_LANGUAGES, wordingFor } from '../src/shared/wording';
import type { Review } from '../src/shared/reviews';

const NOW = Date.UTC(2026, 9, 28, 12);
const review = (o: Partial<Review> = {}): Review => ({
  id: 'r1', author: 'Ann Lee', rating: 5, text: 'Great place', publishedAt: '2026-10-24T13:35:40.173Z', language: 'en', photoUrl: 'https://lh3.googleusercontent.com/a',
  replyText: 'Thanks!', replyAt: '2026-10-25T09:00:00.000Z', url: 'https://www.google.com/maps/reviews/data=x', ...o,
});
const data = (reviews: Review[], extra: Partial<WallData> = {}): WallData => ({ placeId: 'ChIJabc', placeName: 'Cafe Roma', placeImageUrl: 'https://lh5.googleusercontent.com/p', rating: 4.6, totalReviews: 7927, reviews, ...extra });
const set = (o: any = {}): Settings => normalizeSettings(o);
const html = (d: WallData, o: any = {}, lang = 'en') => buildWall(d, set(o), lang, NOW).html;
const css = (o: any = {}) => buildWall(data([review()]), set(o), 'en', NOW).css;

describe('buildWall', () => {
  it('shows author, text, reply, date, rating summary, photo and a safe link', () => {
    const out = html(data([review()]), { show: { reply: true, link: true } });
    for (const part of ['Ann Lee', 'Great place', 'Thanks!', '4.6', '7,927 Google reviews', 'October 24, 2026', 'lh3.googleusercontent.com', 'target="_blank" rel="noopener noreferrer"']) expect(out).toContain(part);
    expect(out).toContain('referrerpolicy="no-referrer"');
  });
  it('draws stars as SVG shapes, never text characters', () => {
    const out = html(data([review({ rating: 3 })]));
    expect(out).not.toContain('★');
    expect((out.match(/class="s on"/g) ?? []).length).toBe(3 + 5); // 3 on the review, 5 in the header (4.6 rounds to 5)
    expect(out).toContain('class="s off"');
    expect(out).toContain('<use href="#st"/>');
  });
  it('escapes everything a reviewer, owner or the header title could type', () => {
    const evil = '<img src=x onerror=alert(1)> "q" \'s\' &';
    const out = html(data([review({ author: evil, text: evil, replyText: evil, url: 'https://x.test/"onmouseover="alert(1)', photoUrl: 'https://x.test/"onerror="alert(1)' })], { placeName: evil, placeImageUrl: 'https://x.test/"onerror="alert(1)' }), { headerTitle: evil });
    expect(out).not.toContain('<img src=x');
    expect(out).not.toContain('onmouseover="alert');
    expect(out).not.toContain('onerror="alert');
    expect(escapeHtml(evil)).toContain('&lt;img');
  });
  it('by default a card is compact: photo, name, date, stars and a short review, with no reply, link, badge or button', () => {
    const out = html(data([review()]));
    for (const part of ['class="av', 'Ann Lee', 'October 24, 2026', 'Great place']) expect(out).toContain(part);
    for (const part of ['Thanks!', 'class="link"', 'class="bdg"', 'class="btn"']) expect(out).not.toContain(part);
  });
  it('every show option hides its part', () => {
    const d = data([review()]);
    const on = { reply: true, link: true };
    const without = (key: string) => html(d, { show: { ...on, [key]: false } });
    expect(without('header')).not.toContain('class="title"');
    expect(without('placeImage')).not.toContain('class="pimg"');
    expect(without('rating')).not.toContain('<strong>');
    expect(without('count')).not.toContain('Google reviews');
    expect(without('text')).not.toContain('Great place');
    expect(without('date')).not.toContain('October 24');
    expect(without('name')).not.toContain('Ann Lee');
    expect(without('photo')).not.toContain('class="av');
    expect(without('reply')).not.toContain('Thanks!');
    expect(without('link')).not.toContain('class="link"');
    expect(html(d, { show: { stars: false, rating: false } })).not.toContain('class="stars"');
  });
  it('the title is the owner text, else the business name, else the language default', () => {
    const d = data([review()]);
    expect(html(d, { headerTitle: 'What guests say' })).toContain('What guests say');
    expect(html(d)).toContain('>Cafe Roma<');
    expect(html(d, { show: { placeName: false } })).toContain('>Google Reviews<');
    expect(html(data([review()], { placeName: '' }))).toContain('>Google Reviews<');
  });
  it('the business photo and the leave-a-review button need their data and option', () => {
    expect(html(data([review()], { placeImageUrl: '' }))).not.toContain('class="pimg"');
    expect(html(data([review()]))).toContain('class="pimg"');
    expect(html(data([review()]))).not.toContain('class="btn"');
    expect(html(data([review()]), { show: { leaveButton: true } })).toContain('search.google.com/local/writereview?placeid=ChIJabc');
    expect(html(data([review()], { placeId: '' }), { show: { leaveButton: true } })).not.toContain('writereview');
  });
  it('the check mark is off by default and goes where the owner chooses', () => {
    const d = data([review()]);
    expect(html(d)).not.toContain('class="bdg"');
    const where = (style: string) => html(d, { show: { badge: true }, badgeStyle: style });
    expect(where('name')).toMatch(/class="author">Ann Lee<span class="bdg"/);
    expect(where('image')).toMatch(/<img [^>]*><span class="bdg"/);
    expect(where('stars')).toMatch(/<\/svg><span class="bdg"[^>]*>.*?<\/span><\/div>/);
    expect(where('name')).toContain('aria-label="Review from Google"');
  });
  it('shows letters when there is no photo, and star-only reviews say so', () => {
    const out = html(data([review({ photoUrl: '', text: '', author: '' })]));
    expect(out).toContain('class="av ini');
    expect(out).toContain('No written review');
    expect(out).toContain('A Google user');
  });
  it('formats names and dates the way the owner chose', () => {
    const d = data([review({ author: 'Amir Hamja' })]);
    expect(html(d, { nameFormat: 'first' })).toContain('class="author">Amir<');
    expect(html(d, { nameFormat: 'firstInitial' })).toContain('class="author">Amir H.<');
    expect(html(d, { nameFormat: 'initials' })).toContain('class="author">AH<');
    expect(html(d, { dateFormat: 'dayMonthYear' })).toContain('24 October 2026');
    expect(html(d, { dateFormat: 'iso' })).toContain('2026-10-24');
    expect(html(d, { dateFormat: 'relative' })).toContain('4 days ago');
  });
  it('long reviews: Read more cuts at the chosen length and keeps the full text; Cut off has no button; Full text shows everything', () => {
    const long = 'word '.repeat(80).trim();
    const d = data([review({ text: long, replyText: '' })]);
    const more = html(d, { textFormat: 'readMore', truncate: 60 });
    expect(more).toContain('data-more');
    expect(more).toContain('class="t-short"');
    expect(more).toContain('…');
    expect(more).toContain(`class="t-full">${long}<`);
    const cut = html(d, { textFormat: 'truncate', truncate: 60 });
    expect(cut).not.toContain('data-more');
    expect(cut).not.toContain(long);
    const full = html(d, { textFormat: 'full', truncate: 60 });
    expect(full).not.toContain('data-more');
    expect(full).toContain(long);
    expect(html(data([review({ text: 'short', replyText: '' })]), { truncate: 60 })).not.toContain('data-more');
  });
  it('a long owner reply also gets Read more', () => {
    expect(html(data([review({ text: 'ok', replyText: 'thanks '.repeat(40) })]), { show: { reply: true } })).toContain('data-more');
  });
  it('carousel and slider have arrows and dots, each switchable; the others have a Show more button only past one page', () => {
    for (const t of ['carousel', 'slider']) {
      expect(html(data([review()]), { template: t })).toContain('data-dir="1"');
      expect(html(data([review()]), { template: t })).toContain('class="dots"');
      expect(html(data([review()]), { template: t, show: { arrows: false } })).not.toContain('data-dir');
      expect(html(data([review()]), { template: t, show: { dots: false } })).not.toContain('class="dots"');
    }
    const many = data(Array.from({ length: PAGE_SIZE + 3 }, (_, i) => review({ id: `r${i}` })));
    for (const t of ['grid', 'masonry', 'list']) {
      const out = html(many, { template: t });
      expect(out).not.toContain('data-dir');
      expect(out).toContain('data-showmore');
      expect((out.match(/data-extra/g) ?? []).length).toBe(3);
    }
    expect(html(data([review()]), { template: 'grid' })).not.toContain('data-showmore');
    expect(MAX_DOTS).toBeGreaterThan(3);
  });
  it('every template renders, with the column and alignment classes', () => {
    for (const t of TEMPLATES) expect(html(SAMPLE, { template: t, columns: 4, align: 'center' })).toContain(`t-${t}`);
    expect(html(SAMPLE, { template: 'grid', columns: 4 })).toContain('cols-4');
    expect(html(SAMPLE, { align: 'right' })).toContain('al-right');
  });
  it('has accessible star labels and a scrollable list', () => {
    const out = html(data([review()]));
    expect(out).toContain('aria-label="Rated 5.0 out of 5"');
    expect(out).toContain('tabindex="0"');
  });
  it('speaks the site language, with English for unknown ones', () => {
    expect(html(data([review({ text: '' })]), {}, 'fr-FR')).toContain('Aucun avis écrit');
    expect(html(data([review({ text: '' })]), {}, 'xx')).toContain('No written review');
    expect(html(data([review()]), {}, 'de')).toContain('7.927 Google-Bewertungen');
  });
  it('autoplay is only set for carousel and slider', () => {
    expect(html(data([review()]), { template: 'slider', autoplay: true })).toContain('data-autoplay');
    expect(html(data([review()]), { template: 'grid', autoplay: true })).not.toContain('data-autoplay');
  });
  it('never contains two curly braces in a row in the markup (Wix template placeholder rule)', () => {
    for (const t of TEMPLATES) expect(html(SAMPLE, { template: t, show: { badge: true } })).not.toContain('{{');
  });
});

describe('header position, name links and the empty message', () => {
  it('the header can sit above or at the left, and the cards are in their own body', () => {
    const d = data([review()]);
    expect(html(d)).toContain('h-top');
    expect(html(d, { headerLayout: 'side' })).toContain('h-side');
    expect(html(d, { headerLayout: 'side' })).toMatch(/<div class="inner"><header class="head">.*<\/header><div class="body">/);
    expect(css({ headerLayout: 'side' })).toContain('.h-side .head');
  });
  it('a name is a link to the review only when the owner turns it on and the review has a link', () => {
    const d = data([review()]);
    expect(html(d)).not.toContain('class="alink"');
    const on = html(d, { show: { nameLink: true } });
    expect(on).toContain('<a class="alink" href="https://www.google.com/maps/reviews/data=x" target="_blank" rel="noopener noreferrer">Ann Lee</a>');
    expect(html(data([review({ url: '' })]), { show: { nameLink: true } })).not.toContain('class="alink"');
    expect(html(d, { show: { nameLink: true, name: false } })).not.toContain('class="alink"');
  });
  it('the empty wall is one friendly line in the site language, in the owner colours', () => {
    const e = buildEmpty(set({ colors: { background: '#001122' } }), 'fr');
    expect(e.html).toContain('Aucun avis à afficher pour le moment.');
    expect(e.css).toContain('--gr-bg: #001122');
    expect(buildEmpty(set(), 'xx').html).toContain('No reviews to show yet.');
    expect(buildEmpty(set(), 'en').html).not.toContain('{{');
  });
});

describe('css', () => {
  it('starts with a white background and the reference colours and font', () => {
    const c = css();
    for (const part of ['--gr-bg: #ffffff', '--gr-text: #212121', '--gr-star: #ff8a00', '--gr-card: #f4f5f7', 'Roboto']) expect(c).toContain(part);
  });
  it('the owner sets every colour, can go transparent, and can use the site font', () => {
    const c = css({ colors: { background: '#001122', card: '#223344', text: '#ffffff', star: '#00ff00', button: '#ff00ff' } });
    for (const part of ['--gr-bg: #001122', '--gr-card: #223344', '--gr-text: #ffffff', '--gr-star: #00ff00', '--gr-btn: #ff00ff']) expect(c).toContain(part);
    expect(css({ transparent: true })).toContain('--gr-bg: transparent');
    expect(css({ font: 'site' })).toContain('font-family: inherit');
    expect(css({ font: 'site' })).not.toContain('Roboto');
  });
  it('sets the text size in pixels and the corner radius', () => {
    expect(css({ textSize: 'small' })).toContain('font-size: 13px');
    expect(css({})).toContain('font-size: 15px');
    expect(css({ radius: 'none' })).toContain('--gr-r: 0px');
    expect(css({ radius: 'large' })).toContain('--gr-r: 20px');
  });
  it('never puts owner text into the stylesheet', () => {
    expect(css({ headerTitle: '</style><script>alert(1)</script>' })).not.toContain('alert');
  });
});

describe('text helpers', () => {
  it('initials, tones and names', () => {
    expect(initialsOf('Ann Lee')).toBe('AL');
    expect(initialsOf('madonna')).toBe('M');
    expect(initialsOf('  ')).toBe('?');
    expect(initialsOf('Jean Luc Picard')).toBe('JP');
    expect(avatarTone('Ann Lee')).toBe(avatarTone('Ann Lee'));
    expect(avatarTone('Ann Lee')).toMatch(/^c[0-7]$/);
    expect(formatName('Jean Luc Picard', 'firstInitial')).toBe('Jean P.');
    expect(formatName('madonna', 'firstInitial')).toBe('madonna');
    expect(formatName('  Ann  Lee ', 'full')).toBe('Ann  Lee');
  });
  it('cuts text at a word near the limit, keeps short text, and counts emoji as one character', () => {
    expect(cutText('short', 60)).toEqual({ short: 'short', cut: false });
    const r = cutText('alpha beta gamma delta epsilon', 20);
    expect(r.cut).toBe(true);
    expect(r.short).toBe('alpha beta gamma…');
    expect(cutText('\u{1F600}'.repeat(10), 5)).toEqual({ short: '\u{1F600}'.repeat(5) + '…', cut: true });
  });
});

describe('dates', () => {
  const iso = '2026-10-24T13:35:40.173Z';
  it('formats in the owner style', () => {
    expect(formatDateStyle(iso, 'en', 'monthDayYear', NOW)).toBe('October 24, 2026');
    expect(formatDateStyle(iso, 'en', 'dayMonthYear', NOW)).toBe('24 October 2026');
    expect(formatDateStyle(iso, 'en', 'iso', NOW)).toBe('2026-10-24');
    expect(formatDateStyle(iso, 'en', 'numeric', NOW)).toBe('10/24/2026');
    expect(formatDateStyle(iso, 'en', 'relative', NOW)).toBe('4 days ago');
    expect(formatDateStyle(iso, 'fr', 'dayMonthYear', NOW)).toBe('24 octobre 2026');
  });
  it('relative dates move from days to weeks, months and years', () => {
    const ago = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
    expect(formatDateStyle(ago(0), 'en', 'relative', NOW)).toBe('today');
    expect(formatDateStyle(ago(14), 'en', 'relative', NOW)).toBe('2 weeks ago');
    expect(formatDateStyle(ago(90), 'en', 'relative', NOW)).toBe('3 months ago');
    expect(formatDateStyle(ago(800), 'en', 'relative', NOW)).toBe('2 years ago');
  });
  it('empty or broken dates give nothing, and an unknown language falls back to English', () => {
    expect(formatDateStyle('', 'en', 'iso')).toBe('');
    expect(formatDateStyle('nope', 'en', 'relative')).toBe('');
    expect(formatDateStyle(iso, 'zz-invalid', 'monthDayYear', NOW)).toBe('October 24, 2026');
  });
});

describe('wording', () => {
  it('every language fills every string', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const w = wordingFor(lang);
      for (const v of [w.title, w.ownerReply, w.readMore, w.readLess, w.previous, w.next, w.viewOnGoogle, w.anonymous, w.noText, w.leaveReview, w.showMore, w.fromGoogle, w.noReviews]) expect(v.length).toBeGreaterThan(1);
      expect(w.reviewsCount('5', false)).toContain('5');
      expect(w.googleCount('5', false)).toContain('5');
      expect(w.starsLabel('4.6')).toContain('4.6');
    }
    expect(resolveLanguage('pt-BR')).toBe('pt');
  });
});
