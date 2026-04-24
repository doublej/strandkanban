import { ensureVapidKeys } from '$lib/vapid';
import type { RequestHandler } from './$types';
import { ok, wrap } from '$lib/server/response';

export const GET: RequestHandler = wrap(async () => {
	const { publicKey } = ensureVapidKeys();
	return ok({ publicKey });
});
