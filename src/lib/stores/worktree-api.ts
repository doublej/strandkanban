/**
 * Client-side fetch wrappers for worktree HTTP endpoints.
 */
const BASE = 'http://localhost:9347/worktrees';

export async function createWorktreeApi(repoPath: string, ticketId: string): Promise<string> {
	const res = await fetch(BASE, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ repoPath, ticketId }),
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data.error ?? 'Failed to create worktree');
	return data.path;
}

export interface WorktreeInfo {
	ticketId: string;
	path: string;
}

export async function listWorktreesApi(repoPath: string): Promise<WorktreeInfo[]> {
	const res = await fetch(`${BASE}?repoPath=${encodeURIComponent(repoPath)}`);
	const data = await res.json();
	if (!res.ok) throw new Error(data.error ?? 'Failed to list worktrees');
	return data.worktrees;
}

export async function removeWorktreeApi(repoPath: string, ticketId: string): Promise<void> {
	const res = await fetch(BASE, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ repoPath, ticketId }),
	});
	if (!res.ok) {
		const data = await res.json();
		throw new Error(data.error ?? 'Failed to remove worktree');
	}
}
