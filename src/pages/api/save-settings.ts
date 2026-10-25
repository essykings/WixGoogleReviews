import type { APIRoute } from 'astro';
import { describeError } from '../../shared/errors';
import { readInstance } from '../../shared/instance';
import { planOf } from '../../shared/plan';
import { normalizeSettings, stripProFeatures } from '../../shared/settings';
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
    const info = await readInstance();
    if (!info.instanceId) return Response.json({ ok: false, message: 'Could not tell which site this is.' }, { status: 401 });
    const plan = planOf(info);
    const settings = stripProFeatures(normalizeSettings(raw), plan);
    await saveSettings(siteData(info.instanceId), settings, plan);
    return Response.json({ ok: true, settings, plan });
  } catch (error) {
    console.error('save-settings failed', error);
    return Response.json({ ok: false, message: 'Could not save your changes. Please try again.', detail: describeError(error) }, { status: 500 });
  }
};
