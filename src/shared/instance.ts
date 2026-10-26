import { appInstances } from '@wix/app-management';
import { auth } from '@wix/essentials';
import { createClient, AppStrategy } from '@wix/sdk';
import { WIX_CLIENT_ID } from 'astro:env/client';
import { WIX_CLIENT_SECRET } from 'astro:env/server';

export interface InstanceInfo {
  instanceId?: string;
  packageName?: string;
  isFree?: boolean;
  siteLanguage?: string;
  /** Support details, only for the back office (see insights.ts). Never sent to the browser. */
  ownerEmail?: string;
  siteUrl?: string;
  siteName?: string;
}

function pick(data: any): InstanceInfo {
  return {
    instanceId: data?.instance?.instanceId,
    packageName: data?.instance?.billing?.packageName,
    isFree: data?.instance?.isFree,
    siteLanguage: data?.site?.locale,
    ownerEmail: data?.site?.ownerInfo?.email,
    siteUrl: data?.site?.url,
    siteName: data?.site?.siteDisplayName,
  };
}

/** The first read: who is asking, with the plan their login was issued with (which can be stale after an upgrade). */
export async function readFirst(): Promise<InstanceInfo> {
  return pick(await auth.elevate(appInstances.getAppInstance)());
}

/** The plan read again with a fresh app login for this site. Null if it fails (the first read is then used). */
export async function readFresh(instanceId: string): Promise<InstanceInfo | null> {
  try {
    const fresh = createClient({
      auth: AppStrategy({ appId: WIX_CLIENT_ID, appSecret: WIX_CLIENT_SECRET, instanceId }),
      modules: { appInstances },
    });
    return { ...pick(await fresh.appInstances.getAppInstance()), instanceId };
  } catch (e) {
    console.error('fresh plan read failed, using the first read', e);
    return null;
  }
}

/**
 * The site making this request, as the app. The instance ID comes from Wix, never from the browser.
 * The plan is read again with a fresh login (see readFresh); if that fails, the first read is used.
 */
export async function readInstance(): Promise<InstanceInfo> {
  const first = await readFirst();
  if (!first.instanceId) return first;
  // A paid plan cannot be older than the real one in a way that matters here (an upgrade is the stale case), and the fresh read
  // costs about 5 seconds, so only look again when the first read says Free or does not know.
  if (first.isFree === false) return first;
  const latest = await readFresh(first.instanceId);
  if (!latest) return first;
  // The fresh read wins, but a missing support detail never blanks one the first read had.
  return {
    ...first,
    ...latest,
    instanceId: first.instanceId,
    ownerEmail: latest.ownerEmail ?? first.ownerEmail,
    siteUrl: latest.siteUrl ?? first.siteUrl,
    siteName: latest.siteName ?? first.siteName,
  };
}
