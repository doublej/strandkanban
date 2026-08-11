<script lang="ts">
	import Icon from './Icon.svelte';
	import MarkdownContent from './MarkdownContent.svelte';
	import { appendProjectParam } from '$lib/project';
	import { formatTimestamp } from '$lib/utils';
	import { loadIssueHistoryApi, type IssueHistoryEntry } from '$lib/api';

	interface Props {
		issueId: string;
	}

	let { issueId }: Props = $props();

	type RelatedSession = { sessionId: string; agentName?: string; timestamp: string; summary?: string; preview: string[] };
	type RelatedMessage = { role: 'user' | 'assistant' | 'tool'; content: string; toolName?: string; timestamp?: string };

	let relatedSessions = $state<RelatedSession[]>([]);
	let loadingRelated = $state(false);
	let expandedSessionId = $state<string | null>(null);
	let expandedMessages = $state<RelatedMessage[]>([]);
	let loadingExpanded = $state(false);

	// Per-issue version history (lazy-loaded on expand)
	let historyEntries = $state<IssueHistoryEntry[]>([]);
	let historyOpen = $state(false);
	let loadingHistory = $state(false);
	let lastHistoryId: string | undefined;
	$effect(() => {
		// Reset only when the issue id actually changes (not on same-id object replacement).
		const id = issueId;
		if (id === lastHistoryId) return;
		lastHistoryId = id;
		historyOpen = false;
		historyEntries = [];
	});

	async function toggleHistory() {
		if (historyOpen) { historyOpen = false; return; }
		historyOpen = true;
		if (historyEntries.length > 0) return;
		const id = issueId;
		loadingHistory = true;
		try {
			const entries = await loadIssueHistoryApi(id);
			if (issueId === id) historyEntries = entries;
		} catch {
			if (issueId === id) historyEntries = [];
		} finally {
			if (issueId === id) loadingHistory = false;
		}
	}

	$effect(() => {
		const id = issueId;
		if (!id) {
			relatedSessions = [];
			expandedSessionId = null;
			expandedMessages = [];
			return;
		}
		loadingRelated = true;
		fetch(appendProjectParam(`/api/issues/${encodeURIComponent(id)}/agent-sessions`))
			.then((r) => (r.ok ? r.json() : null))
			.then((payload) => { if (issueId === id) relatedSessions = payload?.ok ? (payload.data?.sessions ?? []) : []; })
			.catch(() => { if (issueId === id) relatedSessions = []; })
			.finally(() => { if (issueId === id) loadingRelated = false; });
	});

	async function toggleRelatedChat(sessionId: string) {
		if (expandedSessionId === sessionId) {
			expandedSessionId = null;
			expandedMessages = [];
			return;
		}
		expandedSessionId = sessionId;
		expandedMessages = [];
		loadingExpanded = true;
		try {
			const r = await fetch(appendProjectParam(`/api/agent-sessions/${encodeURIComponent(sessionId)}/history`));
			if (r.ok) {
				const payload = await r.json();
				expandedMessages = payload?.ok ? (payload.data?.messages ?? []) : [];
			}
		} catch {
			expandedMessages = [];
		} finally {
			loadingExpanded = false;
		}
	}

	function formatRelTime(ts: string): string {
		if (!ts) return '';
		try {
			return formatTimestamp(ts).relative;
		} catch {
			return ts;
		}
	}
</script>

{#if relatedSessions.length > 0 || loadingRelated}
	<section class="section">
		<span class="section-label">Related Chats</span>
		{#if loadingRelated && relatedSessions.length === 0}
			<div class="related-empty">Loading…</div>
		{:else}
			<ul class="related-list">
				{#each relatedSessions as session (session.sessionId)}
					{@const isOpen = expandedSessionId === session.sessionId}
					<li class="related-item" class:expanded={isOpen}>
						<button class="related-row" onclick={() => toggleRelatedChat(session.sessionId)}>
							<Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={11} />
							<div class="related-meta">
								<div class="related-title">
									{session.summary || session.agentName || session.sessionId.slice(0, 8)}
								</div>
								{#if session.preview.length > 0}
									<div class="related-preview">{session.preview[0]}</div>
								{/if}
							</div>
							<span class="related-time">{formatRelTime(session.timestamp)}</span>
						</button>
						{#if isOpen}
							<div class="related-history">
								{#if loadingExpanded}
									<div class="related-empty">Loading history…</div>
								{:else if expandedMessages.length === 0}
									<div class="related-empty">No messages.</div>
								{:else}
									{#each expandedMessages as msg, i (i)}
										<div class="chat-msg chat-{msg.role}">
											<span class="chat-role">{msg.role === 'tool' ? (msg.toolName ?? 'tool') : msg.role}</span>
											{#if msg.role === 'assistant'}
												<div class="chat-body"><MarkdownContent content={msg.content} /></div>
											{:else}
												<div class="chat-body chat-plain">{msg.content}</div>
											{/if}
										</div>
									{/each}
								{/if}
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<section class="section">
	<button class="history-toggle" onclick={toggleHistory}>
		<Icon name={historyOpen ? 'chevron-down' : 'chevron-right'} size={11} />
		<span class="section-label">History</span>
	</button>
	{#if historyOpen}
		{#if loadingHistory}
			<div class="related-empty">Loading…</div>
		{:else if historyEntries.length === 0}
			<div class="related-empty">No version history.</div>
		{:else}
			<ul class="history-list">
				{#each historyEntries as entry (entry.hash)}
					<li class="history-item">
						<span class="history-dot"></span>
						<div class="history-meta">
							<div class="history-changes">{entry.changes.join(' · ')}</div>
							<div class="history-time">{formatRelTime(entry.date)}{#if entry.committer} · {entry.committer}{/if}</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</section>

<style>
	.section { margin-bottom: 1.25rem; }

	.section-label {
		display: block;
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-tertiary);
		margin-bottom: 0.375rem;
	}

	/* Related Chats */
	.related-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.related-item {
		border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
		border-radius: 6px;
		background: var(--bg-elevated, rgba(255,255,255,0.02));
		overflow: hidden;
	}
	.related-item.expanded {
		border-color: var(--border-strong, rgba(255,255,255,0.12));
	}
	.related-row {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.625rem;
		background: transparent;
		border: none;
		text-align: left;
		cursor: pointer;
		color: var(--text-primary);
	}
	.related-row:hover { background: rgba(255,255,255,0.03); }
	.related-meta {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.related-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.related-preview {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.related-time {
		font-size: 0.625rem;
		color: var(--text-tertiary);
		white-space: nowrap;
		flex-shrink: 0;
	}
	.related-empty {
		font-size: 0.75rem;
		color: var(--text-tertiary);
		padding: 0.5rem 0.625rem;
	}

	/* Per-issue history timeline */
	.history-toggle {
		display: flex; align-items: center; gap: 0.375rem;
		background: none; border: none; padding: 0; cursor: pointer; color: inherit;
	}
	.history-toggle .section-label { margin: 0; }
	.history-list { list-style: none; margin: 0.5rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
	.history-item { display: flex; align-items: flex-start; gap: 0.5rem; }
	.history-dot {
		flex-shrink: 0; width: 6px; height: 6px; margin-top: 0.3rem; border-radius: 50%;
		background: var(--accent-primary, #6366f1);
	}
	.history-meta { display: flex; flex-direction: column; gap: 0.0625rem; min-width: 0; }
	.history-changes { font-size: 0.6875rem; color: var(--text-secondary); }
	.history-time { font-size: 0.5625rem; color: var(--text-tertiary); }
	.related-history {
		border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
		padding: 0.5rem 0.625rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 320px;
		overflow-y: auto;
	}
	.chat-msg {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.chat-role {
		font-size: 0.5625rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 700;
		color: var(--text-tertiary);
	}
	.chat-user .chat-role { color: var(--accent, #9ca3af); }
	.chat-assistant .chat-role { color: var(--success, #86efac); }
	.chat-body {
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--text-primary);
		word-break: break-word;
	}
	.chat-plain { white-space: pre-wrap; }
</style>
