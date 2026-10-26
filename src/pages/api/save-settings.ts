import type { APIRoute } from 'astro';
import { readFirst, readFresh } from '../../shared/instance';
import { planOf } from '../../shared/plan';
import { needsFreshPlanForSave, normalizeSettings, stripProFeatures } from '../../shared/settings';
import { saveSettings, siteData } from '../../shared/store';

/** Saves the owner's customisations. The plan is read from Wix, never from the browser, and Pro options are removed on Free. */
export const POST: APIRoute = async ({ request }) => {
  let raw: unknown;
  try {
    raw = (await request.json())?.settings;
  } catch {
    return Response.json({ ok: false, message: 'Nothing to save.' }, { status: 400 });
  }
  try {
    const first = await readFirst();
    if (!first.instanceId) return Response.json({ ok: false, message: 'Could not tell which site this is.' }, { status: 401 });
    const normalized = normalizeSettings(raw);
    // The slow fresh plan read is only needed when a site that looks Free is saving Pro options (it may have just upgraded).
    const latest = needsFreshPlanForSave(planOf(first), normalized) ? await readFresh(first.instanceId) : null;
    const plan = planOf(latest ? { ...first, ...latest } : first);
    const settings = stripProFeatures(normalized, plan);
    await saveSettings(siteData(first.instanceId), settings, plan);
    return Response.json({ ok: true, settings, plan });
  } catch (error) {
    console.error('save-settings failed', error);
    return Response.json({ ok: false, message: 'Could not save your changes. Please try again.' }, { status: 500 });
  }
};
