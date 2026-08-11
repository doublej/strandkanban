import { join } from 'path';
import { existsSync, readdirSync, statSync } from 'fs';
import type { Attachment } from '../types';

export function getAttachmentsDir(issueId: string, cwd: string): string {
	return join(cwd, '.beads', 'attachments', issueId);
}

export function getAttachmentsForIssue(issueId: string, cwd: string): Attachment[] {
	const dir = getAttachmentsDir(issueId, cwd);
	if (!existsSync(dir)) return [];

	return readdirSync(dir).map((filename) => {
		const filePath = join(dir, filename);
		const stats = statSync(filePath);
		return {
			filename,
			size: stats.size,
			mimetype: getMimetype(filename),
			created_at: stats.birthtime.toISOString(),
		};
	});
}

export function getAllAttachments(cwd: string): Map<string, Attachment[]> {
	const attachmentsDir = join(cwd, '.beads', 'attachments');
	if (!existsSync(attachmentsDir)) return new Map();

	const result = new Map<string, Attachment[]>();
	for (const issueId of readdirSync(attachmentsDir)) {
		if (!statSync(join(attachmentsDir, issueId)).isDirectory()) continue;
		const attachments = getAttachmentsForIssue(issueId, cwd);
		if (attachments.length > 0) result.set(issueId, attachments);
	}
	return result;
}

export function sanitizeFilename(filename: string): string {
	return filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
}

export function getMimetype(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase() || '';
	const mimeTypes: Record<string, string> = {
		png: 'image/png',
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		gif: 'image/gif',
		webp: 'image/webp',
		svg: 'image/svg+xml',
		pdf: 'application/pdf',
		txt: 'text/plain',
		md: 'text/markdown',
		json: 'application/json',
		zip: 'application/zip',
	};
	return mimeTypes[ext] || 'application/octet-stream';
}

export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
