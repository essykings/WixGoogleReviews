import { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dashboard } from '@wix/dashboard';
import { httpClient } from '@wix/essentials';
import { COLOR_KEYS, DEFAULT_COLORS, type Colors } from '../../../../shared/colors';
import { formatWhen, noticeForResult, planLabel, type Notice } from '../../../../shared/messages';
import type { Plan } from '../../../../shared/plan';
import { SUPPORT_ANSWERS, supportMailto } from '../../../../shared/support';
import { REVIEW_MODAL_ID, REVIEW_PROMPT_DELAY_MS, wantsReviewReset } from '../../../../shared/review-prompt';
import type { Review } from '../../../../shared/reviews';
import {
  ALIGNS, BADGE_STYLES, COLUMNS, COUNTS, DATE_FORMATS, DEFAULT_SETTINGS, FONTS, HEADER_LAYOUTS, MAX_HIDDEN, MAX_TITLE_LENGTH, NAME_FORMATS, RADII, TEMPLATES, TEXT_FORMATS, TEXT_SIZES, TRUNCATE_MAX, TRUNCATE_MIN,
  type Settings, type Show, type SortKey, type Template,
} from '../../../../shared/settings';
import { SAMPLE, type WallData } from '../../../../shared/wall-render';
import { TemplateIcon } from './icons';
import { Preview } from './Preview';
import { Alert, Badge, Button, Card, ColorField, DeviceToggle, Field, Progress, Segmented, Select, Skeleton, Slider, Switch, TagInput, Tabs, TextInput } from './ui';
import './ui.css';

interface Status {
  ok: boolean;
  message?: string;
  plan: Plan;
  siteLanguage?: string;
  /** The site's own ID, shown on the Support tab so we can find the site. */
  supportCode?: string;
  upgradeUrl?: string;
  place: { placeId: string; placeUrl?: string; placeName: string; lastStatus: string; lastSuccessAt: number | null; lastAttemptAt: number | null } | null;
  /** undefined until the reviews request has answered; null when nothing is saved. */
  cache?: { placeId: string; placeName: string; placeImageUrl?: string; rating: number | null; totalReviews: number | null; reviews: Review[]; fetchedAt: number } | null;
  savedPlaces?: { placeId: string; placeName: string; fetchedAt: number; active: boolean }[];
  settings: Settings | null;
}

type Tab = 'connection' | 'layout' | 'settings' | 'support';

const api = (path: string) => new URL(path, import.meta.url).href;

async function call(path: string, init?: RequestInit) {
  const res = await httpClient.fetchWithAuth(api(path), init);
  return res.json();
}

const post = (path: string, body: unknown) => call(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// The last status this browser saw, so the page paints at once on a repeat visit and then refreshes. Nothing private in it:
// the business, its public reviews, the plan and the owner's own settings.
const LAST_KEY = 'grc:last-status:v1';
function readLast(): Status | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    const s = raw ? (JSON.parse(raw) as Status) : null;
    return s && s.ok && s.settings ? s : null;
  } catch {
    return null;
  }
}
function writeLast(s: Status) {
  try {
    const raw = JSON.stringify(s);
    if (raw.length < 400_000) localStorage.setItem(LAST_KEY, raw);
  } catch {
    /* storage unavailable: just no instant paint next time */
  }
}

const TEMPLATE_NAMES: Record<Template, string> = { carousel: 'Carousel', slider: 'Slider', grid: 'Grid', masonry: 'Masonry', list: 'List' };
const SORT_NAMES: Record<SortKey, string> = { newest: 'Newest first', oldest: 'Oldest first', highest: 'Highest rating first', lowest: 'Lowest rating first' };
const HEADER_SHOW: Array<[keyof Show, string]> = [
  ['header', 'Title'],
  ['placeName', 'Business name as title'],
  ['placeImage', 'Business photo'],
  ['rating', 'Stars and score'],
  ['count', 'Number of reviews text'],
  ['leaveButton', '"Leave a review" button'],
];
const CARD_SHOW: Array<[keyof Show, string]> = [
  ['photo', 'Reviewer photo'],
  ['name', 'Reviewer name'],
  ['nameLink', 'Link the name to the review'],
  ['date', 'Date'],
  ['stars', 'Stars'],
  ['text', 'Review text'],
  ['reply', 'Owner replies'],
  ['link', '"View on Google" link'],
  ['badge', 'Check mark badge'],
];
const RADIUS_NAMES = { none: 'Square', small: 'Small', medium: 'Medium', large: 'Large' } as const;
const SIZE_NAMES = { small: 'Small', medium: 'Medium', large: 'Large' } as const;
const DATE_NAMES: Record<(typeof DATE_FORMATS)[number], string> = { monthDayYear: 'Month Day, Year', dayMonthYear: 'Day Month Year', iso: 'Year-Month-Day', numeric: 'Numbers (local style)', relative: '3 days ago' };
const NAME_NAMES: Record<(typeof NAME_FORMATS)[number], string> = { full: 'Full name', first: 'First name only', firstInitial: 'First name and last initial', initials: 'Initials only' };
const ALIGN_NAMES = { left: 'Left', center: 'Center', right: 'Right' } as const;
const TEXT_FORMAT_NAMES = { readMore: 'Read more', full: 'Full text', truncate: 'Cut off' } as const;
const HEADER_LAYOUT_NAMES = { top: 'Above the reviews', side: 'At the left' } as const;
const BADGE_NAMES = { name: 'Next to name', image: 'On photo', stars: 'After stars' } as const;
const FONT_NAMES = { clean: 'Clean (like Roboto)', site: 'My site font' } as const;
const COLOR_LABELS: Record<keyof Colors, string> = { background: 'Background', card: 'Cards', text: 'Text', star: 'Stars', button: 'Button' };

const kindFor = (k: Notice['kind']) => (k === 'danger' ? 'destructive' : k === 'standard' ? 'info' : k === 'warning' ? 'warning' : k);

const DashboardPage: FC = () => {
  const [status, setStatus] = useState<Status | null>(() => readLast());
  const [loadError, setLoadError] = useState(false);
  const [cacheReady, setCacheReady] = useState<boolean>(() => readLast()?.cache !== undefined);
  const [draft, setDraft] = useState<Settings>(() => readLast()?.settings ?? DEFAULT_SETTINGS);
  const [tab, setTab] = useState<Tab>('connection');
  const [saving, setSaving] = useState(false);
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [busy, setBusy] = useState(false);
  // What the busy state is for, so the wait message matches it (disconnecting must not say "Finding your reviews").
  const [busyFor, setBusyFor] = useState<'save' | 'disconnect' | 'refresh'>('save');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'phone'>('desktop');
  const [stage, setStage] = useState<'light' | 'dark'>('light');
  const [expanded, setExpanded] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshedOnce = useRef(false);
  const edited = useRef(false);
  const promptTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(promptTimer.current), []);

  const load = useCallback(async (keepDraft = false) => {
    // Both requests start now. The small one (plan, business, settings) shows the controls as soon as it answers; the
    // saved reviews (bigger) fill the preview when they arrive.
    const started = performance.now();
    const reviewsRequest = call('/api/review-cache').catch(() => null);
    try {
      const s: Status = await call('/api/review-status');
      if (!s.ok) throw new Error(s.message);
      const smallMs = Math.round(performance.now() - started);
      setStatus((prev) => ({ ...s, cache: prev?.cache }));
      // Keep what the owner is already changing; otherwise show what is saved.
      if (s.settings && !keepDraft && !edited.current) setDraft(s.settings);
      setLoadError(false);
      void reviewsRequest.then((c) => {
        if (!c?.ok) return;
        const reviewsMs = Math.round(performance.now() - started);
        setStatus((prev) => {
          const next = prev ? { ...prev, cache: c.cache ?? null } : prev;
          if (next) writeLast(next);
          return next;
        });
        setCacheReady(true);
        // What the owner or we can read in the browser console to see where the time goes.
        console.info('[Google Reviews Carousel] loaded', { controlsAfterMs: smallMs, reviewsAfterMs: reviewsMs, server: (s as any).timings, serverReviews: c.timings });
      });
      return s;
    } catch (e) {
      console.error('[Google Reviews Carousel] could not load', e);
      setLoadError(true);
      return null;
    }
  }, []);

  useEffect(() => {
    // Testing hook: open the dashboard with ?reset-review-prompt to see the review prompt again.
    if (wantsReviewReset(window.location.search)) {
      void post('/api/reset-review-prompt', {}).then((r) => dashboard.showToast({ message: r?.ok ? 'Review prompt reset' : 'Could not reset the review prompt', type: r?.ok ? 'success' : 'error' }));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const s = await load();
      if (s?.place && !refreshedOnce.current) {
        // Old reviews, or just upgraded? The rules decide whether this really calls the provider; usually it does nothing.
        refreshedOnce.current = true;
        setRefreshing(true);
        try {
          const r = await post('/api/refresh-reviews', { origin: 'dashboard' });
          if (r?.result?.status === 'updated') await load(true);
        } catch {
          /* keep what is saved */
        } finally {
          setRefreshing(false);
        }
      }
    })();
  }, [load]);

  const plan: Plan = status?.plan ?? 'unknown';
  const locked = plan === 'free';
  const dirty = !!status?.settings && JSON.stringify(draft) !== JSON.stringify(status.settings);
  const patch = (p: Partial<Settings>) => {
    edited.current = true;
    setDraft((d) => ({ ...d, ...p }));
  };
  const patchShow = (k: keyof Show, v: boolean) => {
    edited.current = true;
    setDraft((d) => ({ ...d, show: { ...d.show, [k]: v } }));
  };

  const hidden = new Set(draft.hiddenIds);
  const toggleHidden = (id: string) => patch({ hiddenIds: hidden.has(id) ? draft.hiddenIds.filter((h) => h !== id) : [...draft.hiddenIds, id].slice(-MAX_HIDDEN) });

  const previewData: WallData = useMemo(
    () => (status?.cache ? { placeId: status.cache.placeId, placeName: status.cache.placeName, placeImageUrl: status.cache.placeImageUrl ?? '', rating: status.cache.rating, totalReviews: status.cache.totalReviews, reviews: status.cache.reviews } : SAMPLE),
    [status?.cache],
  );

  async function savePlace(placeInput = input) {
    setBusyFor('save');
    setBusy(true);
    setNotice(null);
    setInputError('');
    try {
      const r = await post('/api/register-place', { input: placeInput });
      if (!r.ok) setInputError(r.message ?? 'Something went wrong. Please try again.');
      else {
        setNotice(noticeForResult(r.result));
        setInput(r.placeUrl || r.placeId || placeInput);
      }
      await load(true);
      // The first time reviews are found for this site, ask for an App Market review (the server remembers that it asked).
      // Not straight away: let the owner see their reviews first.
      if (r.ok && r.askForReview) promptTimer.current = window.setTimeout(() => dashboard.openModal({ modalId: REVIEW_MODAL_ID }), REVIEW_PROMPT_DELAY_MS);
    } catch (e) {
      console.error('[Google Reviews Carousel] save place failed', e);
      setNotice({ kind: 'danger', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function refreshNow() {
    setBusyFor('refresh');
    setBusy(true);
    setNotice(null);
    try {
      const r = await post('/api/refresh-reviews', { force: true });
      setNotice(r.ok ? noticeForResult(r.result) : { kind: 'danger', text: r.message ?? 'Could not refresh right now.' });
      await load(true);
    } catch {
      setNotice({ kind: 'danger', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusyFor('disconnect');
    setBusy(true);
    setNotice(null);
    try {
      const r = await post('/api/disconnect-place', {});
      if (!r.ok) throw new Error(r.message);
      setInput('');
      setInputError('');
      setConfirmDisconnect(false);
      await load(true);
    } catch (e) {
      console.error('[Google Reviews Carousel] disconnect failed', e);
      setNotice({ kind: 'danger', text: 'Could not disconnect. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function saveChanges() {
    setSaving(true);
    try {
      const r = await post('/api/save-settings', { settings: draft });
      if (!r.ok) throw new Error(r.message);
      edited.current = false;
      setDraft(r.settings);
      setStatus((s) => {
        const next = s ? { ...s, settings: r.settings, plan: r.plan } : s;
        if (next) writeLast(next);
        return next;
      });
      dashboard.showToast({ message: 'Changes saved', type: 'success' });
    } catch (e) {
      console.error('[Google Reviews Carousel] save failed', e);
      dashboard.showToast({ message: 'Could not save your changes. Please try again.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  const place = status?.place;
  const updatedText = place
    ? place.lastStatus === 'failed'
      ? 'The last update did not work. We will try again soon.'
      : place.lastSuccessAt
        ? `Reviews updated ${formatWhen(place.lastSuccessAt)}`
        : 'Waiting for the first update.'
    : '';
  const dotKind = place ? (place.lastStatus === 'failed' ? 'bad' : place.lastSuccessAt ? 'ok' : 'wait') : 'wait';

  const working = busy || refreshing;
  const savedCount = status?.cache?.reviews.length ?? 0;
  const wanted = locked ? 5 : draft.count;
  const rowTemplate = draft.template === 'carousel' || draft.template === 'slider';

  // ---- the cards ----------------------------------------------------------------------------------------------
  const copySupportCode = async () => {
    try {
      await navigator.clipboard.writeText(status?.supportCode ?? '');
      dashboard.showToast({ message: 'Support code copied', type: 'success' });
    } catch {
      dashboard.showToast({ message: 'Could not copy. Select the code and copy it by hand.', type: 'error' });
    }
  };
  const mailto = supportMailto(status?.supportCode, planLabel(plan));
  const supportCard = (
    <Card title="Need help?" description="Send us your support code and a few words about what is wrong, and we will look into it.">
      <Field label="Your support code" hint="It tells us which site is yours. It is safe to share with us.">
        <div className="row">
          <TextInput label="Your support code" value={status?.supportCode ?? ''} onChange={() => {}} disabled />
          <Button variant="outline" onClick={() => void copySupportCode()} disabled={!status?.supportCode}>Copy</Button>
        </div>
      </Field>
      {mailto ? <a className="btn" href={mailto}>Email support</a> : <Alert kind="info">Our support email address will appear here.</Alert>}
    </Card>
  );
  const answersCard = (
    <Card title="Quick answers" description="The things owners ask most.">
      <div className="stack">
        {SUPPORT_ANSWERS.map((x) => (
          <div key={x.q}>
            <strong>{x.q}</strong>
            <p>{x.a}</p>
          </div>
        ))}
      </div>
    </Card>
  );

  const connectionCard = place ? (
    <Card title="Your business" description="This is the business your reviews come from.">
      <div className="biz">
        {status?.cache?.placeImageUrl && <img className="biz-img" src={status.cache.placeImageUrl} alt="" referrerPolicy="no-referrer" />}
        <div className="biz-main">
          <div className="biz-name">{place.placeName || status?.cache?.placeName || 'Your business'}</div>
          <div className="status">
            <span className={`dot ${dotKind}`} />
            <span>{updatedText}</span>
          </div>
        </div>
        <div className="biz-actions">
          {!confirmDisconnect && plan !== 'free' && <Button variant="ghost" small onClick={() => void refreshNow()} disabled={busy}>Refresh now</Button>}
          {!confirmDisconnect ? (
            <Button variant="outline" onClick={() => setConfirmDisconnect(true)} disabled={busy}>Disconnect</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setConfirmDisconnect(false)} disabled={busy}>Cancel</Button>
              <Button onClick={() => void disconnect()} disabled={busy}>{busy ? 'Working...' : 'Yes, disconnect'}</Button>
            </>
          )}
        </div>
      </div>
      {confirmDisconnect && (
        <Alert kind="info">
          Your reviews will stop showing on your site. If you connect this business again, we will collect its reviews again, which takes about half a minute.
        </Alert>
      )}
      {notice && <Alert kind={kindFor(notice.kind)}>{notice.text}</Alert>}
    </Card>
  ) : (
    <Card title="Your business" description="Paste your business’s Google Maps link. A Place ID works too.">
      <Field label="Google Maps link" error={inputError} hint="On Google Maps, search for your business, press Share, then Copy link, and paste it here.">
        <div className="row">
          <TextInput label="Google Maps link" value={input} onChange={setInput} placeholder="https://www.google.com/maps/place/..." disabled={busy} error={!!inputError} onEnter={() => input.trim() && void savePlace()} />
          <Button onClick={() => void savePlace()} disabled={busy || !input.trim()}>{busy ? 'Working...' : 'Save place'}</Button>
        </div>
      </Field>
      {busy && <div className="progress inline" role="status"><span className="spin" aria-hidden="true" /><span>{busyFor === 'disconnect' ? 'Disconnecting your business…' : 'Finding your reviews. This usually takes 20 to 40 seconds, so please keep this page open.'}</span></div>}
      {notice && <Alert kind={kindFor(notice.kind)}>{notice.text}</Alert>}
      {!busy && <Alert kind="info">Add your business to see your own reviews in the preview.</Alert>}
    </Card>
  );

  const previewCard = (
    <section className="card">
      <div className="pv-bar">
        <h2 className="card-t">Preview</h2>
        <div className="row">
          {tab !== 'connection' && <Button variant="outline" small onClick={() => setExpanded((e) => !e)}>{expanded ? 'Back to settings' : 'Expand preview'}</Button>}
          <Segmented label="Preview background" value={stage} onChange={setStage} options={[{ value: 'light', label: 'Light site' }, { value: 'dark', label: 'Dark site' }]} />
          <DeviceToggle value={device} onChange={setDevice} />
        </div>
      </div>
      {working && <Progress>Updating your reviews. This can take up to a minute, and you can keep editing.</Progress>}
      {status && cacheReady && !status.cache && <div className="pv-empty"><Alert kind="info">Showing example reviews until you save your business.</Alert></div>}
      <div className={`pv-stage ${stage === 'dark' ? 'dark' : ''}`}>
        <div className={`pv-frame ${device === 'phone' ? 'phone' : device === 'tablet' ? 'tablet' : ''}`}>
          {cacheReady ? (
            <Preview data={previewData} settings={draft} plan={plan} lang={status?.siteLanguage ?? 'en'} />
          ) : (
            <div className="sk-card" aria-busy="true" aria-label="Loading your reviews"><Skeleton height={18} width="35%" /><Skeleton height={150} /></div>
          )}
        </div>
      </div>
    </section>
  );

  const templateCard = (
    <Card title="Template" description="How your reviews are laid out.">
      <div className="tpls">
        {TEMPLATES.map((t) => (
          <button key={t} type="button" className="tpl" aria-pressed={draft.template === t} onClick={() => patch({ template: t })}>
            <TemplateIcon template={t} />
            {TEMPLATE_NAMES[t]}
          </button>
        ))}
      </div>
      {(draft.template === 'grid' || draft.template === 'masonry') && (
        <Field label="Columns">
          <Segmented label="Columns" value={draft.columns} onChange={(v) => patch({ columns: v })} options={COLUMNS.map((c) => ({ value: c, label: String(c) }))} />
        </Field>
      )}
      {rowTemplate && (
        <div className="switches">
          <Switch label="Arrows" checked={draft.show.arrows} onChange={(v) => patchShow('arrows', v)} />
          <Switch label="Dots" checked={draft.show.dots} onChange={(v) => patchShow('dots', v)} />
          <Switch label="Autoplay" checked={draft.autoplay} onChange={(v) => patch({ autoplay: v })} />
        </div>
      )}
    </Card>
  );

  const alignCard = (
    <Card title="Alignment and shape">
      <Field label="Align">
        <Segmented label="Align" value={draft.align} onChange={(v) => patch({ align: v })} options={ALIGNS.map((a) => ({ value: a, label: ALIGN_NAMES[a] }))} />
      </Field>
      <Field label="Corners">
        <Segmented label="Corners" value={draft.radius} onChange={(v) => patch({ radius: v })} options={RADII.map((r) => ({ value: r, label: RADIUS_NAMES[r] }))} />
      </Field>
    </Card>
  );

  const headerCard = (
    <Card title="Header" description="The business name, photo and rating.">
      <Field label="Position">
        <Segmented label="Header position" value={draft.headerLayout} onChange={(v) => patch({ headerLayout: v })} options={HEADER_LAYOUTS.map((h) => ({ value: h, label: HEADER_LAYOUT_NAMES[h] }))} />
      </Field>
      <div className="switches">
        {HEADER_SHOW.map(([k, label]) => (
          <Switch key={k} label={label} checked={draft.show[k]} onChange={(v) => patchShow(k, v)} />
        ))}
      </div>
      {draft.show.header && (
        <Field label="Title" hint={'Leave empty to use your business name, or "Google Reviews" if that is switched off.'}>
          <TextInput label="Title" value={draft.headerTitle} onChange={(v) => patch({ headerTitle: v })} placeholder="Google Reviews" maxLength={MAX_TITLE_LENGTH} />
        </Field>
      )}
    </Card>
  );

  const whichCard = (
    <Card title="Which reviews to show" description={locked ? 'Free shows your 5 newest reviews. Pro lets you choose.' : 'Choose and filter the reviews that appear.'}>
      {locked && status?.upgradeUrl && (
        <Alert kind="info" title="These options are on Pro" action={<Button small href={status.upgradeUrl}>Upgrade</Button>}>
          More than 5 reviews, star filters, keywords and sorting.
        </Alert>
      )}
      <Field label="Number of reviews" pro={locked}>
        <Segmented label="Number of reviews" value={locked ? 5 : draft.count} onChange={(v) => patch({ count: v })} options={COUNTS.map((c) => ({ value: c, label: String(c), locked: locked && c > 5 }))} />
        {status?.cache && (
          <div className="count-note" aria-live="polite">
            {working ? (
              <Progress>Updating your reviews. This can take up to a minute, and you can keep editing.</Progress>
            ) : savedCount < wanted && !locked && (status.cache.totalReviews ?? Infinity) > savedCount ? (
              <>
                <span>You have {savedCount} reviews saved, so up to {savedCount} can show.</span>
                <Button variant="outline" small onClick={() => void refreshNow()}>Get more reviews</Button>
              </>
            ) : (
              <span>Showing up to {Math.min(wanted, savedCount)} of your {savedCount} saved reviews.</span>
            )}
          </div>
        )}
      </Field>
      <Field label="Stars to show" pro={locked} hint="Pick the ratings you want to include.">
        <div className="stars-pick">
          {[5, 4, 3, 2, 1].map((n) => (
            <button
              key={n}
              type="button"
              className="chip"
              aria-pressed={draft.stars.includes(n)}
              disabled={locked}
              onClick={() => {
                const on = draft.stars.includes(n);
                if (on && draft.stars.length === 1) return;
                patch({ stars: on ? draft.stars.filter((s) => s !== n) : [...draft.stars, n].sort() });
              }}
            >
              {n} {'★'}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Only show reviews that mention" pro={locked} hint="Type a word and press Enter. A review needs at least one of them.">
        <TagInput label="Include keywords" value={draft.include} onChange={(v) => patch({ include: v })} placeholder="e.g. friendly, clean" disabled={locked} />
      </Field>
      <Field label="Hide reviews that mention" pro={locked} hint="Reviews with any of these words are left out.">
        <TagInput label="Exclude keywords" value={draft.exclude} onChange={(v) => patch({ exclude: v })} placeholder="e.g. rude, slow" disabled={locked} />
      </Field>
      <Field label="Order" pro={locked}>
        <Select label="Order" value={locked ? 'newest' : draft.sort} onChange={(v) => patch({ sort: v as SortKey })} disabled={locked} options={(Object.keys(SORT_NAMES) as SortKey[]).map((k) => ({ value: k, label: SORT_NAMES[k] }))} />
      </Field>
      <Switch label="Only reviews with text" checked={draft.onlyWithText} onChange={(v) => patch({ onlyWithText: v })} />
    </Card>
  );

  const contentCard = (
    <Card title="What each review shows">
      <div className="switches">
        {CARD_SHOW.map(([k, label]) => (
          <Switch key={k} label={label} checked={draft.show[k]} onChange={(v) => patchShow(k, v)} />
        ))}
      </div>
      {draft.show.badge && (
        <Field label="Check mark position" hint="A small check mark meaning the review comes from Google. It does not mean Google verified the reviewer.">
          <Segmented label="Check mark position" value={draft.badgeStyle} onChange={(v) => patch({ badgeStyle: v })} options={BADGE_STYLES.map((b) => ({ value: b, label: BADGE_NAMES[b] }))} />
        </Field>
      )}
    </Card>
  );

  const savedReviews = status?.cache?.reviews ?? [];
  const hideCard = (
    <Card title="Hide reviews" description="Pick reviews you do not want to show. They stay hidden after updates.">
      {!cacheReady ? (
        <Progress>Loading your reviews…</Progress>
      ) : savedReviews.length === 0 ? (
        <Alert kind="info">Save your business first, and your reviews will be listed here.</Alert>
      ) : (
        <>
          <div className="status">
            <span>{draft.hiddenIds.length} hidden</span>
            <Button variant="ghost" small onClick={() => patch({ hiddenIds: [] })} disabled={draft.hiddenIds.length === 0}>Show all</Button>
          </div>
          <ul className="hide-list">
            {savedReviews.map((r) => (
              <li key={r.id} className={hidden.has(r.id) ? 'is-hidden' : ''}>
                <div className="hide-main">
                  <strong>{r.author || 'A Google user'}</strong> <span className="hide-stars">{'\u2605'.repeat(r.rating)}</span>
                  <div className="hide-text">{r.text || 'No written review'}</div>
                </div>
                <Button variant={hidden.has(r.id) ? 'default' : 'outline'} small onClick={() => toggleHidden(r.id)}>{hidden.has(r.id) ? 'Hidden' : 'Hide'}</Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );

  const textCard = (
    <Card title="Text and dates">
      <Field label="Date format">
        <Select label="Date format" value={draft.dateFormat} onChange={(v) => patch({ dateFormat: v as Settings['dateFormat'] })} options={DATE_FORMATS.map((d) => ({ value: d, label: DATE_NAMES[d] }))} />
      </Field>
      <Field label="Reviewer name">
        <Select label="Reviewer name" value={draft.nameFormat} onChange={(v) => patch({ nameFormat: v as Settings['nameFormat'] })} options={NAME_FORMATS.map((n) => ({ value: n, label: NAME_NAMES[n] }))} />
      </Field>
      <Field label="Long reviews">
        <Segmented label="Long reviews" value={draft.textFormat} onChange={(v) => patch({ textFormat: v })} options={TEXT_FORMATS.map((t) => ({ value: t, label: TEXT_FORMAT_NAMES[t] }))} />
      </Field>
      {draft.textFormat !== 'full' && (
        <Field label="Characters shown before the cut" hint="Reviews longer than this are shortened.">
          <Slider label="Characters shown" value={draft.truncate} min={TRUNCATE_MIN} max={TRUNCATE_MAX} step={10} onChange={(v) => patch({ truncate: v })} />
        </Field>
      )}
      <Field label="Font">
        <Segmented label="Font" value={draft.font} onChange={(v) => patch({ font: v })} options={FONTS.map((f) => ({ value: f, label: FONT_NAMES[f] }))} />
      </Field>
      <Field label="Text size">
        <Segmented label="Text size" value={draft.textSize} onChange={(v) => patch({ textSize: v })} options={TEXT_SIZES.map((t) => ({ value: t, label: SIZE_NAMES[t] }))} />
      </Field>
    </Card>
  );

  const colorsCard = (
    <Card title="Colors" description="Start from a white background and change any color.">
      <Switch label="Transparent background (use my site's)" checked={draft.transparent} onChange={(v) => patch({ transparent: v })} />
      <div className="colors">
        {COLOR_KEYS.filter((k) => !(draft.transparent && k === 'background')).map((k) => (
          <ColorField key={k} label={COLOR_LABELS[k]} value={draft.colors[k]} fallback={DEFAULT_COLORS[k]} onChange={(v) => patch({ colors: { ...draft.colors, [k]: v } })} />
        ))}
      </div>
    </Card>
  );

  // ---- the page -----------------------------------------------------------------------------------------------
  return (
    <div className="sc">
      <div className="wrap">
        <div className="top">
          <div>
            <h1>Google Reviews Carousel</h1>
            <p>Show your Google reviews on your site. Pick a layout, filter the reviews and match your brand.</p>
          </div>
          <div className="actions">
            {status && <Badge kind={plan === 'free' ? 'default' : 'dark'}>{planLabel(plan)}</Badge>}
            {status && locked && status.upgradeUrl && <Button variant="outline" href={status.upgradeUrl}>Upgrade to Pro</Button>}
            {dirty && <Badge kind="warn">Unsaved changes</Badge>}
            {dirty && <Button variant="ghost" onClick={() => { edited.current = false; if (status?.settings) setDraft(status.settings); }} disabled={saving}>Discard</Button>}
            <Button variant="outline" onClick={() => { edited.current = true; setDraft(locked ? { ...DEFAULT_SETTINGS, count: 5 } : DEFAULT_SETTINGS); }} disabled={saving || !status} title="Put every option back to how it started. Nothing is saved until you press Save changes.">Reset to default</Button>
            <Button onClick={() => void saveChanges()} disabled={!dirty || saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
          </div>
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'connection', label: 'Connection' },
            { id: 'layout', label: 'Layout' },
            { id: 'settings', label: 'Settings' },
            { id: 'support', label: 'Support' },
          ]}
        />

        {loadError && !status && <Alert kind="destructive" title="We could not load your reviews" action={<Button variant="outline" small onClick={() => void load()}>Try again</Button>}>Please try again in a moment.</Alert>}

        {!status && !loadError && (
          <div className="stack" aria-busy="true" aria-label="Loading">
            <div className="sk-card"><Skeleton height={20} width="40%" /><Skeleton height={36} /><Skeleton height={14} width="60%" /></div>
            <div className="sk-card"><Skeleton height={20} width="20%" /><Skeleton height={180} /></div>
          </div>
        )}

        {status && tab === 'connection' && (
          <div className="stack">
            {connectionCard}
            {previewCard}
          </div>
        )}

        {status && tab === 'support' && <div className="stack">{supportCard}{answersCard}</div>}

        {status && tab !== 'connection' && tab !== 'support' && expanded && <div className="stack wide">{previewCard}</div>}

        {status && tab === 'layout' && !expanded && (
          <div className="layout">
            <div className="col">
              {templateCard}
              {headerCard}
              {alignCard}
            </div>
            <div className="col sticky">{previewCard}</div>
          </div>
        )}

        {status && tab === 'settings' && !expanded && (
          <div className="layout">
            <div className="col">
              {whichCard}
              {hideCard}
              {contentCard}
              {textCard}
              {colorsCard}
            </div>
            <div className="col sticky">{previewCard}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
