import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';

const run = promisify(execFile);

/**
 * Is each provider's CLI actually on PATH? Without this you pick codex or opencode
 * in settings and only find out at the first agent start, as a spawn ENOENT buried
 * in a pane. Claude is the in-process SDK — nothing to install, nothing to probe.
 */
async function probe(binary: string) {
	try {
		const { stdout } = await run(binary, ['--version'], { timeout: 5000 });
		return { available: true, detail: stdout.trim().split('\n')[0] || 'installed' };
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code;
		return { available: false, detail: code === 'ENOENT' ? `\`${binary}\` not on PATH` : String(code ?? err) };
	}
}

export const GET: RequestHandler = async () => {
	const [codex, opencode] = await Promise.all([probe('codex'), probe('opencode')]);
	return json({
		claude: { available: true, detail: 'in-process SDK' },
		codex,
		opencode
	});
};
