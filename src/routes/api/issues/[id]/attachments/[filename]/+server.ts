import { json, error } from '@sveltejs/kit';
import { join } from 'path';
import { existsSync, unlinkSync, readFileSync, readdirSync, rmdirSync } from 'fs';
import type { RequestHandler } from './$types';
import { getAttachmentsDir, getMimetype } from '$lib/attachments';
import { resolveProjectCwd } from '$lib/db';

export const GET: RequestHandler = async ({ params, url }) => {
	const cwd = resolveProjectCwd(url);
	const dir = getAttachmentsDir(params.id, cwd);
	const filePath = join(dir, params.filename);

	if (!existsSync(filePath)) {
		throw error(404, 'Attachment not found');
	}

	const content = readFileSync(filePath);
	const mimetype = getMimetype(params.filename);

	return new Response(content, {
		headers: {
			'Content-Type': mimetype,
			'Content-Disposition': `attachment; filename="${params.filename}"`,
		},
	});
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	const cwd = resolveProjectCwd(url);
	const dir = getAttachmentsDir(params.id, cwd);
	const filePath = join(dir, params.filename);

	if (!existsSync(filePath)) {
		return json({ error: 'Attachment not found' }, { status: 404 });
	}

	unlinkSync(filePath);

	const remainingFiles = readdirSync(dir);
	if (remainingFiles.length === 0) {
		rmdirSync(dir);
	}

	return json({ success: true });
};
