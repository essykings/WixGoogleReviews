import type { APIRoute } from 'astro';
import { describeError } from '../../shared/errors';
import { readInstance } from '../../shared/instance';
import { loadPlaceRecord, savePlace, siteData } from '../../shared/store';

/** Testing hook: clears the "we already asked for a review" flag for this site, so the prompt can be seen again. */
export const POST: APIRoute = async () => {
  try {
    const info = await readInstance();
    if (!info.instanceId) return Response.json({ ok: false }, { status: 401 });
    const data = siteData(info.instanceId);
    const record = await loadPlaceRecord(data);
    if (record) await savePlace(data, { ...record, reviewAskedAt: null });
    return Response.json({ ok: true });
  } catch (error) {
    console.error('reset-review-prompt failed', error);
    return Response.json({ ok: false, detail: describeError(error) }, { status: 500 });
  }
};
