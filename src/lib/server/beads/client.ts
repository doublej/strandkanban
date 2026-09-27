import { unwrapBdJson, type ExportIssue, type ListIssuesOptions } from 'beads-sdk';
import type { Comment, Issue, MutationEntry } from '$lib/types';
import { parseEvent, type DbEvent } from '$lib/event-parse';
import { BeadsMutations } from './mutations';
import { mapIssues } from './issue-view';
import { journal, journalEnabled } from './journal';

export { bdEnv, unwrapBdJson } from 'beads-sdk';
export type { BdDoctorFinding } from 'beads-sdk';
export type { CreateOpts, UpdateOpts } from './mutations';

export function unwrapEnvelopeText(stdout: string): string {
	if (!stdout.startsWith('{')) return stdout;
	try {
		return JSON.stringify(unwrapBdJson(stdout));
	} catch {
		return stdout;
	}
}

export interface GetIssuesOptions extends ListIssuesOptions {
	slim?: boolean;
}

export class Beads extends BeadsMutations {
	async export(): Promise<ExportIssue[]> {
		return this.sdk.export();
	}

	async count(): Promise<number> {
		return (await this.export()).filter((row) => row.status !== 'tombstone').length;
	}

	async issues(options: GetIssuesOptions = {}): Promise<Issue[]> {
		const { slim = false, ...filters } = options;
		const rows = await this.export();
		const issues = await this.sdk.issues({ ...filters, includeAttachments: !slim });
		return mapIssues(rows, issues, slim);
	}

	async issue(id: string): Promise<Issue | null> {
		const issues = await this.issues({ ids: [id] });
		return issues.find((issue) => issue.id === id) ?? null;
	}

	async comments(id: string): Promise<Comment[]> {
		return (await this.issue(id))?.comments ?? [];
	}

	async recentEvents(limit = 100): Promise<{ events: MutationEntry[]; unsupported: boolean }> {
		// The journal works in every storage mode; the events table needs a Dolt server.
		if (journalEnabled(this.cwd)) return { events: await journal(this.cwd).recent(limit), unsupported: false };
		const result = await this.sdk.events(limit);
		return { events: result.events.flatMap((row) => parseEvent(row as DbEvent)), unsupported: result.unsupported };
	}

	async readJson<T>(args: string[]): Promise<T> {
		return unwrapBdJson<T>(await this.read(args));
	}

	async blockedIds(): Promise<Set<string>> {
		return new Set((await this.sdk.blocked()).map((issue) => issue.id));
	}
}

const registry = new Map<string, Beads>();

export function beads(cwd: string): Beads {
	let instance = registry.get(cwd);
	if (!instance) {
		instance = new Beads(cwd);
		registry.set(cwd, instance);
	}
	return instance;
}
