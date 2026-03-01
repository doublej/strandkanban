import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';
import { resolveProjectCwd } from '$lib/db';
import { extractErrorMessage } from '$lib/server-utils';

const execAsync = promisify(exec);

export const POST: RequestHandler = async ({ params, request, url }) => {
	const { reason } = await request.json().catch(() => ({ reason: 'Completed' }));
	const reasonText = reason || 'Completed';

	const cwd = resolveProjectCwd(url);
	try {
		const { stdout, stderr } = await execAsync(
			`bd close ${params.id} --reason "${reasonText.replace(/"/g, '\\"')}"`,
			{ cwd }
		);
		return json({ success: true, message: stdout.trim(), warning: stderr || undefined });
	} catch (err: unknown) {
		return json({ error: extractErrorMessage(err, 'Failed to close issue') }, { status: 500 });
	}
};
