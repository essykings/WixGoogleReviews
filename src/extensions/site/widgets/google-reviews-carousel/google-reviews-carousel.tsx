import { items } from '@wix/data';
import { httpClient } from '@wix/essentials';
import { window as wixWindow } from '@wix/site-window';
import { pickActive } from '../../../../shared/cache-rules';
import { rowToCache, settingsFromRow } from '../../../../shared/cache-row';
import { REVIEW_CACHE_COLLECTION, WIDGET_SETTINGS_COLLECTION } from '../../../../shared/config';
import { PRO_LIMITS, type Plan } from '../../../../shared/plan';
import { selectForDisplay } from '../../../../shared/review-filter';
import { decodeSettings, type Settings } from '../../../../shared/settings';
import { buildEmpty, buildWall, EDITOR_NOTE, SAMPLE, type WallData } from '../../../../shared/wall-render';
import { wireWall } from '../../../../shared/wall-behavior';

interface Saved {
  data: WallData;
  settings: Settings;
  plan: Plan;
  /** When the reviews were fetched; 0 when there are none yet. */
  fetchedAt: number;
}

/** What this site shows: the saved reviews and the owner's saved customisations. Null when there is nothing at all. */
async function readSaved(): Promise<Saved | null> {
  try {
    const [cacheRes, settingsRes] = await Promise.all([
      items.query(REVIEW_CACHE_COLLECTION).limit(10).find(),
      items.query(WIDGET_SETTINGS_COLLECTION).limit(1).find().catch(() => ({ items: [] as any[] })),
    ]);
    // A site holds a handful of copies at most; the flagged one wins, else the newest (see pickActive).
    const c = pickActive(cacheRes.items.map(rowToCache));
    const { settings, plan } = settingsRes.items[0] ? settingsFromRow(settingsRes.items[0]) : { settings: decodeSettings(''), plan: 'unknown' as Plan };
    if (!c) return { data: { placeId: '', placeName: '', placeImageUrl: '', rating: null, totalReviews: null, reviews: [] }, settings, plan, fetchedAt: 0 };
    return { data: { placeId: c.placeId, placeName: c.placeName, placeImageUrl: c.placeImageUrl, rating: c.rating, totalReviews: c.totalReviews, reviews: c.reviews }, settings, plan, fetchedAt: c.fetchedAt };
  } catch (e) {
    // TEST BUILD: say why in the console. A visitor still sees nothing rather than an error.
    console.warn('[Google Reviews Carousel] could not read the saved reviews', e);
    return null;
  }
}

class GoogleReviewsCarousel extends HTMLElement {
  private root: ShadowRoot;
  private saved: Saved | null = null;
  private editor = false;
  private refreshed = false;
  private unwire: (() => void) | null = null;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.unwire = wireWall(this.root);
    this.render();
    void this.load();
  }

  disconnectedCallback() {
    this.unwire?.();
    this.unwire = null;
  }

  private async load() {
    // Both reads run at the same time. The Editor shows the real saved reviews too; only when there are none
    // does it fall back to the labelled examples.
    const [mode, saved] = await Promise.all([wixWindow.viewMode().catch(() => ''), readSaved()]);
    this.editor = mode === 'Editor';
    this.saved = saved;
    this.render();
    if (this.editor) return;
    // Old copy? Ask the backend to refresh it, once per page load. The rules there decide whether it really
    // calls the provider; the visitor never waits for this.
    if (this.saved && this.saved.fetchedAt > 0 && !this.refreshed && Date.now() - this.saved.fetchedAt >= PRO_LIMITS.maxAgeMs) {
      this.refreshed = true;
      if (await this.requestRefresh()) {
        this.saved = (await readSaved()) ?? this.saved;
        this.render();
      }
    }
  }

  private async requestRefresh(): Promise<boolean> {
    try {
      const res = await httpClient.fetchWithAuth(new URL('/api/refresh-reviews', import.meta.url).href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: 'visit' }),
      });
      const body = await res.json();
      return body?.ok === true && body?.result?.status === 'updated';
    } catch {
      return false;
    }
  }

  private render() {
    const settings = this.saved?.settings ?? decodeSettings('');
    const plan = this.saved?.plan ?? 'unknown';
    const lang = document.documentElement.lang;
    const hasReal = !!this.saved && this.saved.data.reviews.length > 0;
    const sample = this.editor && !hasReal;
    const base = hasReal ? this.saved!.data : sample ? SAMPLE : null;

    // Nothing to draw. A read that failed (or has not finished) shows nothing; a site with no saved reviews, or filters that
    // leave none, shows one friendly line instead of an empty gap.
    const shown = base ? selectForDisplay(base.reviews, settings, sample ? 'pro' : plan) : [];
    if (!base || shown.length === 0) {
      const loadedButEmpty = !!this.saved || this.editor;
      this.paint(loadedButEmpty ? buildEmpty(settings, lang) : null, '');
      return;
    }
    this.paint(buildWall({ ...base, reviews: shown }, settings, lang), sample ? EDITOR_NOTE : '');
  }

  private paint(built: { html: string; css: string } | null, note: string) {
    if (!built) {
      this.root.innerHTML = '';
      return;
    }
    this.root.innerHTML = `<style></style>${built.html}${note ? `<div class="note"></div>` : ''}`;
    // Text goes in through textContent, never string-built into the page.
    (this.root.querySelector('style') as HTMLStyleElement).textContent = built.css;
    const noteEl = this.root.querySelector('.note');
    if (noteEl) noteEl.textContent = note;
  }
}

export default GoogleReviewsCarousel;
