// Turns what the owner pasted into a business we can look up. Pure, so it is unit-tested.
// Best: the business's Google Maps link (open it on Google Maps, press Share, then Copy link). A Place ID also works:
// 27 characters starting with "ChIJ" or "GhIJ".

import { classifyMapsUrl } from './maps-url';

const ID = '(?:ChIJ|GhIJ)[A-Za-z0-9_-]{23}';
const BARE = new RegExp(`^${ID}$`);
const IN_LINK = new RegExp(`(?:place_id[=:]|!1s)(${ID})(?![A-Za-z0-9_-])`);

export const PLACE_HELP = 'Paste your business’s Google Maps link. Open it on Google Maps, press Share, then Copy link. A Place ID works too.';

export type PlaceParse =
  | { ok: true; kind: 'id'; placeId: string }
  | { ok: true; kind: 'url'; url: string }
  | { ok: true; kind: 'short'; url: string }
  | { ok: false; message: string };

export function parsePlaceInput(input: unknown): PlaceParse {
  const text = typeof input === 'string' ? input.trim() : '';
  if (!text) return { ok: false, message: 'Paste your business’s Google Maps link first.' };
  if (text.length > 2000) return { ok: false, message: 'That is too long to be a Google Maps link.' };
  if (BARE.test(text)) return { ok: true, kind: 'id', placeId: text };
  let decoded = text;
  try {
    decoded = decodeURIComponent(text);
  } catch {
    // keep the raw text
  }
  const inLink = IN_LINK.exec(decoded);
  if (inLink && /^(https?:\/\/|www\.|maps\.|google\.)/i.test(text)) return { ok: true, kind: 'id', placeId: inLink[1] };
  const link = classifyMapsUrl(text);
  if (link) return { ok: true, kind: link.kind === 'place' ? 'url' : 'short', url: link.url };
  return { ok: false, message: PLACE_HELP };
}
