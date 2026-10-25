import { describe, expect, it } from 'vitest';
import { DEFAULT_COLORS, isHex, onColor, resolveColors } from '../src/shared/colors';
import { decodeSettings, DEFAULT_SETTINGS, encodeSettings, normalizeSettings, stripProFeatures, MAX_HIDDEN, TRUNCATE_MAX, TRUNCATE_MIN, usesProFeatures } from '../src/shared/settings';

describe('normalizeSettings', () => {
  it('gives the defaults for nothing, junk and wrong types', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('x')).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ template: 'bogus', count: 7, sort: 3, stars: 'all', columns: 9, show: 5, radius: 'huge', textSize: 1, font: 'comic', dateFormat: 'x', nameFormat: 1, align: 'up', textFormat: 'no', badgeStyle: 'big', truncate: 'lots', transparent: 'yes' })).toEqual(DEFAULT_SETTINGS);
  });
  it('keeps valid values and fills the rest with defaults, so an older save still loads', () => {
    const s = normalizeSettings({ template: 'grid', count: 50, stars: [5, 4, 4, 9, 'x'], show: { photo: false }, skin: 'dark', dateFormat: 'relative', nameFormat: 'firstInitial', align: 'center', textFormat: 'truncate', badgeStyle: 'image', font: 'site' });
    expect(s).toMatchObject({ template: 'grid', count: 50, stars: [4, 5], dateFormat: 'relative', nameFormat: 'firstInitial', align: 'center', textFormat: 'truncate', badgeStyle: 'image', font: 'site' });
    expect(s.show.photo).toBe(false);
    expect(s.show.name).toBe(true);
    expect('skin' in s).toBe(false); // the old themes are gone
  });
  it('cleans the hidden review list and the header position', () => {
    expect(normalizeSettings({ hiddenIds: ['a', 'a', '', 5, 'b', 'x'.repeat(300)] }).hiddenIds).toEqual(['a', 'b']);
    expect(normalizeSettings({ hiddenIds: Array.from({ length: 500 }, (_, i) => `id${i}`) }).hiddenIds).toHaveLength(MAX_HIDDEN);
    expect(normalizeSettings({ hiddenIds: 'nope' }).hiddenIds).toEqual([]);
    expect(normalizeSettings({ headerLayout: 'side' }).headerLayout).toBe('side');
    expect(normalizeSettings({ headerLayout: 'diagonal' }).headerLayout).toBe('top');
    expect(normalizeSettings({}).show.nameLink).toBe(false);
  });
  it('hiding reviews and the header position are not Pro features', () => {
    const s = normalizeSettings({ count: 5, hiddenIds: ['a'], headerLayout: 'side', show: { nameLink: true } });
    expect(usesProFeatures(s)).toBe(false);
    expect(stripProFeatures(s, 'free')).toMatchObject({ hiddenIds: ['a'], headerLayout: 'side' });
  });
  it('limits the cut-off length', () => {
    expect(normalizeSettings({ truncate: 5 }).truncate).toBe(TRUNCATE_MIN);
    expect(normalizeSettings({ truncate: 9999 }).truncate).toBe(TRUNCATE_MAX);
    expect(normalizeSettings({ truncate: 123.4 }).truncate).toBe(123);
  });
  it('cleans keywords: trims, drops duplicates and blanks, limits length and number', () => {
    const s = normalizeSettings({ include: ['  Clean ', 'clean', '', 5, 'x'.repeat(100)], exclude: Array.from({ length: 40 }, (_, i) => `w${i}`) });
    expect(s.include).toEqual(['Clean', 'x'.repeat(40)]);
    expect(s.exclude).toHaveLength(20);
  });
  it('accepts only #rrggbb colours and limits the header title', () => {
    const s = normalizeSettings({ colors: { text: '#112233', background: 'red', star: '#12345', card: '#AABBCC', button: 5 }, headerTitle: `  ${'a'.repeat(100)}` });
    expect(s.colors).toEqual({ text: '#112233', background: '', star: '', card: '#AABBCC', button: '' });
    expect(s.headerTitle).toHaveLength(60);
  });
  it('round-trips, and never throws on bad stored text', () => {
    const s = normalizeSettings({ template: 'masonry', count: 100, include: ['great'], transparent: true });
    expect(decodeSettings(encodeSettings(s))).toEqual(s);
    for (const bad of [undefined, '', 'not json', '[]', 'null']) expect(decodeSettings(bad)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('Pro features', () => {
  const pro = normalizeSettings({ count: 100, stars: [4, 5], include: ['great'], exclude: ['slow'], sort: 'highest', template: 'masonry', colors: { star: '#ff0000' }, dateFormat: 'iso' });
  it('Free loses only count, stars, keywords and sort; everything else stays', () => {
    const free = stripProFeatures(pro, 'free');
    expect(free).toMatchObject({ count: 5, stars: [1, 2, 3, 4, 5], include: [], exclude: [], sort: 'newest', template: 'masonry', dateFormat: 'iso' });
    expect(free.colors.star).toBe('#ff0000');
    expect(usesProFeatures(free)).toBe(false);
  });
  it('Pro and unknown keep everything', () => {
    expect(stripProFeatures(pro, 'pro')).toBe(pro);
    expect(stripProFeatures(pro, 'unknown')).toBe(pro);
    expect(usesProFeatures(pro)).toBe(true);
  });
  it('the default of 10 shown is a Pro number, so Free is held to 5', () => {
    expect(usesProFeatures(normalizeSettings({ count: 5 }))).toBe(false);
    expect(usesProFeatures(DEFAULT_SETTINGS)).toBe(true);
    expect(stripProFeatures(DEFAULT_SETTINGS, 'free').count).toBe(5);
  });
});

describe('colours', () => {
  it('start white with the reference design colours', () => {
    expect(DEFAULT_COLORS.background).toBe('#ffffff');
    expect(Object.values(DEFAULT_COLORS).every(isHex)).toBe(true);
  });
  it('owner colours win, invalid ones are ignored', () => {
    expect(resolveColors({ background: '#112233', star: 'red' })).toMatchObject({ background: '#112233', star: DEFAULT_COLORS.star });
    expect(resolveColors({})).toEqual(DEFAULT_COLORS);
  });
  it('picks readable text for buttons', () => {
    expect(onColor('#ffffff')).toBe('#111111');
    expect(onColor('#212121')).toBe('#ffffff');
    expect(onColor('#2563eb')).toBe('#ffffff');
    expect(onColor('#facc15')).toBe('#111111');
  });
});
