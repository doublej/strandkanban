import type { RequestHandler } from './$types';
import { ok, wrap } from '$lib/server/response';

export const GET: RequestHandler = wrap(async () => {
	try {
		const res = await fetch('http://localhost:9347/health', {
			signal: AbortSignal.timeout(2000),
		});
		return ok({ healthy: res.ok });
	} catch {
		return ok({ healthy: false });
	}
});
