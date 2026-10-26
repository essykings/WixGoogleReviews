import type { APIRoute } from 'astro';
import { disconnectedPlace } from '../../shared/cache-rules';
import { readInstance } from '../../shared/instance';
import { deleteAllCaches, loadPlaceRecord, savePlace, siteData } from '../../shared/store';

/**
 * The owner disconnects their business: the business and every saved copy of its reviews (names and photo links) are deleted.
 * The settings are kept, and so is the usage counter, so disconnecting cannot be used to dodge the monthly cap.
 */
export const POST: APIRoute = async () => {
  try {
    const info = await readInstance();
    if (!info.instanceId) return Response.json({ ok: false, message: 'Could not tell which site this is.' }, { status: 401 });
    const data = siteData(info.instanceId);
    const record = await loadPlaceRecord(data);
    await deleteAllCaches(data);
    await savePlace(data, disconnectedPlace(record, Date.now()));
    return Response.json({ ok: true });
  } catch (error) {
    console.error('disconnect-place failed', error);
    return Response.json({ ok: false, message: 'Could not disconnect. Please try again.' }, { status: 500 });
  }
};
