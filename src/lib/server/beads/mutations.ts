import {
	BeadsClient,
	type BdDoctorReport,
	type BdPing,
	type BdResult,
	type CreateIssueOptions,
	type UpdateIssueOptions
} from 'beads-sdk';
import { recordTouchedCwd } from '$lib/touched-cwds';

export interface CreateOpts extends CreateIssueOptions {
	/** App/tool field name kept at this boundary; the SDK uses the bd schema name. */
	acceptance?: string;
}
export type UpdateOpts = UpdateIssueOptions;

interface RunOptions {
	timeoutMs?: number;
	maxBuffer?: number;
}

function requireSuccess(result: BdResult): string {
	if (!result.success) throw new Error(result.error ?? 'bd command failed');
	return result.stdout ?? '';
}

export class BeadsMutations {
	protected readonly sdk: BeadsClient;

	constructor(readonly cwd: string) {
		recordTouchedCwd(cwd);
		this.sdk = new BeadsClient(cwd);
	}

	invalidate(): void {
		this.sdk.invalidate();
	}

	async read(args: string[], options?: RunOptions): Promise<string> {
		return this.sdk.read(args, options);
	}

	async write(args: string[], options?: RunOptions): Promise<string> {
		return this.sdk.write(args, options);
	}

	async create(title: string, options?: CreateOpts): Promise<{ id?: string; issue: unknown }> {
		const { acceptance, ...fields } = options ?? {};
		const result = await this.sdk.create(title, {
			...fields,
			acceptance_criteria: fields.acceptance_criteria ?? acceptance
		});
		requireSuccess(result);
		return { id: result.id, issue: result.issue };
	}

	async update(id: string, updates: UpdateOpts): Promise<void> {
		requireSuccess(await this.sdk.update(id, updates));
	}

	async claim(id: string, actor: string): Promise<void> {
		requireSuccess(await this.sdk.claim(id, actor));
	}

	async heartbeat(id: string, actor: string): Promise<void> {
		requireSuccess(await this.sdk.heartbeat(id, actor));
	}

	async reclaim(olderThan = '10m'): Promise<string> {
		return requireSuccess(await this.sdk.reclaim(olderThan));
	}

	async delete(id: string): Promise<void> {
		requireSuccess(await this.sdk.delete(id));
	}

	async close(id: string, reason = 'Completed'): Promise<void> {
		requireSuccess(await this.sdk.close(id, reason));
	}

	async addDep(id: string, dependsOn: string, type = 'blocks'): Promise<void> {
		requireSuccess(await this.sdk.addDependency(id, dependsOn, type));
	}

	async removeDep(id: string, dependsOn: string): Promise<void> {
		requireSuccess(await this.sdk.removeDependency(id, dependsOn));
	}

	async addComment(id: string, text: string): Promise<void> {
		requireSuccess(await this.sdk.addComment(id, text));
	}

	async setState(id: string, dimension: string, value: string, reason?: string): Promise<void> {
		requireSuccess(await this.sdk.setState(id, dimension, value, reason));
	}

	async promote(id: string, reason?: string): Promise<void> {
		requireSuccess(await this.sdk.promote(id, reason));
	}

	async ping(): Promise<BdPing> {
		return this.sdk.ping();
	}

	async doctor(): Promise<BdDoctorReport> {
		return this.sdk.doctor();
	}

	async ensureAutoExport(): Promise<void> {
		return this.sdk.ensureAutoExport();
	}
}
