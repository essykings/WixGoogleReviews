import type { APIRoute } from 'astro';
import { readInstance } from '../../shared/instance';
import { planOf } from '../../shared/plan';

export const GET: APIRoute = async () => {
  try {
    const { ownerEmail, siteUrl, siteName, ...info } = await readInstance();
    return Response.json({ ...info, plan: planOf(info) });
  } catch (error) {
    console.error('get-instance failed', error);
    return Response.json({ error: 'Could not read the plan' }, { status: 500 });
  }
};
