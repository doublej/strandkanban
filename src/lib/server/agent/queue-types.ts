import type { ProviderId } from "./providers/types";

export type QueueItem = {
	ticketId: string;
	agentName: string;
	cwd: string;
	title: string;
	description: string;
	priority: number;
	issueType: string;
	model?: string;
	/** Which adapter runs this worker. Claude when unset — every pre-existing item. */
	provider?: ProviderId;
	useWorktree: boolean;
	enqueuedAt: string; // ISO timestamp
};
