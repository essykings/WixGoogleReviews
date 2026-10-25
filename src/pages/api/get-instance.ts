import type { APIRoute } from 'astro';
import { describeError } from '../../shared/errors';
import { readInstance } from '../../shared/instance';
import { planOf } from '../../shared/plan';

export const GET: APIRoute = async () => {
  try {
    const info = await readInstance();
    return Response.json({ ...info, plan: planOf(info) });
  } catch (error) {
    console.error('get-instance failed', error);
    return Response.json({ error: 'Could not read the plan', detail: describeError(error) }, { status: 500 });
  }
};
