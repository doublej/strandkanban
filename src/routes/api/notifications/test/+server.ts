import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { getAllSubscriptions, removeSubscription } from '$lib/push-db';
import { ensureVapidKeys } from '$lib/vapid';
import webpush from 'web-push';
import { ok, wrap, ApiError } from '$lib/server/response';

export const POST: RequestHandler = wrap(async () => {
	const { publicKey, privateKey } = ensureVapidKeys();
	const subject = env.VAPID_SUBJECT || 'mailto:admin@beadskanban.local';
	webpush.setVapidDetails(subject, publicKey, privateKey);

	const subscriptions = getAllSubscriptions();
	if (subscriptions.length === 0) {
		throw new ApiError('No push subscriptions registered', 404, 'NOT_FOUND');
	}

	const payload = JSON.stringify({
		title: 'Beads Kanban',
		body: 'Test notification — push is working!',
		data: { type: 'test' },
	});

	const results = await Promise.allSettled(
		subscriptions.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
					payload,
				);
			} catch (err: unknown) {
				const error = err as { statusCode?: number };
				if (error.statusCode === 404 || error.statusCode === 410) {
					removeSubscription(sub.endpoint);
				}
				throw err;
			}
		}),
	);

	return ok({
		sent: results.filter((r) => r.status === 'fulfilled').length,
		failed: results.filter((r) => r.status === 'rejected').length,
	});
});
