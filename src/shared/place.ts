// Turns what the owner pasted into a Google Place ID. Pure, so it is unit-tested.
// A Place ID is 27 characters starting with "ChIJ" or "GhIJ". Maps links only carry one in a few shapes.

const ID = '(?:ChIJ|GhIJ)[A-Za-z0-9_-]{23}';
const BARE = new RegExp(`^${ID}$`);
const IN_LINK = new RegExp(`(?:place_id[=:]|!1s)(${ID})(?![A-Za-z0-9_-])`);

export type PlaceParse = { ok: true; placeId: string } | { ok: false; message: string };

export function parsePlaceInput(input: unknown): PlaceParse {
  const text = typeof input === 'string' ? input.trim() : '';
  if (!text) return { ok: false, message: 'Paste your Place ID first.' };
  if (text.length > 2000) return { ok: false, message: 'That is too long to be a Place ID or a link.' };
  if (BARE.test(text)) return { ok: true, placeId: text };
  let decoded = text;
  try {
    decoded = decodeURIComponent(text);
  } catch {
    // keep the raw text
  }
  const found = IN_LINK.exec(decoded);
  if (found) return { ok: true, placeId: found[1] };
  return {
    ok: false,
    message: 'That is not a Place ID. It is 27 characters long and starts with ChIJ. Use Google’s Place ID Finder to look yours up.',
  };
}
