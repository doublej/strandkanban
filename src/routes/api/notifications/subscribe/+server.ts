import type { RequestHandler } from './$types';
import { saveSubscription } from '$lib/push-db';
import { ok, wrap, ApiError } from '$lib/server/response';

export const POST: RequestHandler = wrap(async ({ request }) => {
	const { endpoint, keys } = (await request.json()) ?? {};
	if (!endpoint || !keys?.p256dh || !keys?.auth) {
		throw new ApiError('Invalid subscription data', 400, 'VALIDATION');
	}
	saveSubscription(endpoint, keys.p256dh, keys.auth);
	return ok({ subscribed: true });
});
