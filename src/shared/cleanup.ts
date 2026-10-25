// What happens when the app is removed from a site: its stored reviews, photo links and settings are deleted.
// Each step is best effort and independent, because after removal Wix may no longer let us reach the site's data.
// Pure apart from what it is given, so it is unit-tested.

export interface CleanupDeps {
  /** Deletes the saved copies, the saved settings and the registered business on the site. */
  removeSiteData(): Promise<void>;
  /** Anything else to forget (optional, run alongside). */
  forgetSite?(): Promise<void>;
}

export interface CleanupResult {
  siteData: 'removed' | 'failed';
  other: 'done' | 'failed' | 'skipped';
}

export async function cleanupSite(deps: CleanupDeps): Promise<CleanupResult> {
  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
      return true;
    } catch (e) {
      console.warn('cleanup step failed', e instanceof Error ? e.message : e);
      return false;
    }
  };
  const [data, other] = await Promise.all([run(deps.removeSiteData), deps.forgetSite ? run(deps.forgetSite) : Promise.resolve(null)]);
  return { siteData: data ? 'removed' : 'failed', other: other === null ? 'skipped' : other ? 'done' : 'failed' };
}
