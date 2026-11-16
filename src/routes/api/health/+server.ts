import type { RequestHandler } from './$types';
import { ok, wrap } from '$lib/server/response';
import { resolveProjectCwd, markDoctorRan } from '$lib/server/cwd';
import { beads, type BdDoctorFinding } from '$lib/server/beads/client';

/** Liveness only — cheap enough for the badge's 2s poll. */
export const GET: RequestHandler = wrap(async ({ url }) => {
	return ok({ ping: await beads(resolveProjectCwd(url)).ping() });
});

/**
 * Liveness plus the once-per-cwd repair pass (`bd config set export.auto`, `bd doctor --fix`).
 * These used to ride along on the GET, so a 2s health poll could kick off a doctor run;
 * they belong behind an explicit call. Still gated per-cwd by markDoctorRan, so this stays
 * request-scoped rather than moving to server boot, which only knows a single cwd.
 */
export const POST: RequestHandler = wrap(async ({ url }) => {
	const cwd = resolveProjectCwd(url);
	const bd = beads(cwd);
	const ping = await bd.ping();
	let doctor: { findings: BdDoctorFinding[] } | undefined;
	if (ping.ok && markDoctorRan(cwd)) {
		await bd.ensureAutoExport();
		const report = await bd.doctor();
		// Errors only: doctor warns about environment setup (plugins, gitignore, upstream) on most projects.
		const noteworthy = report.findings.filter((f) => f.severity === 'error');
		if (noteworthy.length > 0) doctor = { findings: noteworthy };
	}
	return ok({ ping, doctor });
});
