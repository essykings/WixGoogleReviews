import { describe, expect, it, vi } from 'vitest';
import { cleanupSite } from '../src/shared/cleanup';

describe('cleanupSite', () => {
  it('removes the site data', async () => {
    const removeSiteData = vi.fn(async () => {});
    expect(await cleanupSite({ removeSiteData })).toEqual({ siteData: 'removed', other: 'skipped' });
    expect(removeSiteData).toHaveBeenCalledOnce();
  });
  it('runs the optional extra step too, and one failing step never stops the other or throws', async () => {
    const forgetSite = vi.fn(async () => {});
    expect(await cleanupSite({ removeSiteData: async () => { throw new Error('site gone'); }, forgetSite })).toEqual({ siteData: 'failed', other: 'done' });
    expect(forgetSite).toHaveBeenCalled();
    const removeSiteData = vi.fn(async () => {});
    expect(await cleanupSite({ removeSiteData, forgetSite: async () => { throw new Error('office down'); } })).toEqual({ siteData: 'removed', other: 'failed' });
    expect(removeSiteData).toHaveBeenCalled();
  });
  it('is safe to run twice', async () => {
    const deps = { removeSiteData: async () => {} };
    expect(await cleanupSite(deps)).toEqual(await cleanupSite(deps));
  });
});
