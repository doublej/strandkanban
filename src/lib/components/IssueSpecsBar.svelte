<script lang="ts">
	import type { Issue, Column } from '$lib/types';
	import { getPriorityConfig, getTypeIcon, formatTimestamp, getDueInfo, formatMinutes, isStale, isAgentAssignee as checkAgentAssignee } from '$lib/utils';
	import Icon from './Icon.svelte';

	interface Props {
		issue: Issue;
		column: Column;
		activeAgents: string[];
		onviewchat?: (agentName: string) => void;
	}

	let { issue, column, activeAgents, onviewchat }: Props = $props();

	const priority = $derived(getPriorityConfig(issue.priority));
	const dueInfo = $derived(getDueInfo(issue.due_at));
	const stale = $derived(isStale(issue));
	const isAgentAssignee = $derived(checkAgentAssignee(issue.assignee));

	const activeAgentPane = $derived.by(() => {
		const expectedPaneName = `${issue.id}-agent`;
		return activeAgents.includes(expectedPaneName) ? expectedPaneName : null;
	});
</script>

<div class="specs-bar">
	<div class="specs-primary">
		<span class="spec-status" style="--status-color: {column.accent}">
			<Icon name={column.icon} size={11} />
			<span>{column.label}</span>
		</span>
		<span class="spec-priority" style="--c: {priority.color}">
			<span class="priority-dot"></span>
			<span>{priority.label}</span>
		</span>
		<span class="spec-type">
			<Icon name={getTypeIcon(issue.issue_type)} size={11} />
			<span>{issue.issue_type}</span>
		</span>
	</div>
	<div class="specs-secondary">
		{#if issue.created_at}
			{@const ts = formatTimestamp(issue.created_at)}
			<span class="spec-time" title="{ts.absolute}">{ts.relative}</span>
		{/if}
		{#if dueInfo}
			<span class="spec-due {dueInfo.level}" title="Due {dueInfo.absolute}"><Icon name="calendar" size={11} /><span>{dueInfo.label}</span></span>
		{/if}
		{#if issue.estimated_minutes}
			<span class="spec-est" title="Estimate"><Icon name="clock" size={11} /><span>{formatMinutes(issue.estimated_minutes)}</span></span>
		{/if}
		{#if stale}
			<span class="spec-stale" title="No updates in 30+ days"><Icon name="alert-circle" size={11} /><span>stale</span></span>
		{/if}
		{#if issue.defer_until}
			{@const dts = formatTimestamp(issue.defer_until)}
			<span class="spec-defer" title="Deferred until {dts.absolute}">deferred · {dts.relative}</span>
		{/if}
		{#if issue.assignee}
			{#if isAgentAssignee}
				<span class="spec-agent" class:working={issue.status === 'in_progress'}>
					<Icon name="agent" size={12} />
					<span>{issue.assignee}</span>
					{#if issue.status === 'in_progress'}
						<span class="working-dot"></span>
					{/if}
				</span>
				{#if activeAgentPane && onviewchat}
					<button class="chat-link" onclick={() => onviewchat(activeAgentPane!)} title="View chat session">
						<Icon name="message" size={11} />
						<span>Chat</span>
					</button>
				{/if}
			{:else}
				<span class="spec-human">
					<span class="avatar-dot"></span>
					<span>{issue.assignee}</span>
				</span>
			{/if}
		{/if}
	</div>
</div>

<style>
	/* View mode - specs bar */
	.specs-bar {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 8px;
		padding: 0.875rem 0;
		margin-bottom: 1.25rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.specs-primary,
	.specs-secondary {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		min-width: 0;
	}
	.specs-secondary:empty { display: none; }

	/* Unified chip base */
	.spec-status, .spec-priority, .spec-type, .spec-agent, .spec-human, .chat-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 26px;
		padding: 0 10px;
		border-radius: 4px;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.spec-status { background: var(--status-color); color: white; }
	.spec-priority { background: var(--surface-panel, rgba(255,255,255,0.04)); color: var(--text-secondary); }

	.priority-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c); flex-shrink: 0; }

	.spec-type { background: var(--surface-panel, rgba(255,255,255,0.04)); color: var(--text-tertiary); }

	.spec-time {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 10px;
		font-weight: 500;
		color: var(--text-tertiary);
		flex-shrink: 0;
	}

	.spec-agent { background: rgba(16, 185, 129, 0.1); color: #10b981; }
	.spec-agent.working { background: rgba(16, 185, 129, 0.15); }

	/* bd 1.0 scheduling chips */
	.spec-due, .spec-est {
		display: inline-flex; align-items: center; gap: 3px;
		padding: 0.1875rem 0.375rem; border-radius: var(--radius-xs);
		font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 10px; font-weight: 600;
		flex-shrink: 0;
	}
	.spec-est { background: rgba(148, 163, 184, 0.14); color: var(--text-tertiary); }
	.spec-due.normal { background: rgba(99, 102, 241, 0.12); color: #6366f1; }
	.spec-due.soon { background: rgba(245, 158, 11, 0.14); color: #f59e0b; }
	.spec-due.overdue { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
	.spec-stale {
		display: inline-flex; align-items: center; gap: 3px;
		padding: 0.1875rem 0.375rem; border-radius: var(--radius-xs);
		font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 10px; font-weight: 600;
		background: rgba(245, 158, 11, 0.12); color: #f59e0b; flex-shrink: 0;
	}
	.spec-defer {
		font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 10px; font-weight: 500;
		color: var(--text-tertiary); flex-shrink: 0;
	}

	.spec-human {
		background: var(--surface-panel, rgba(255,255,255,0.04));
		color: var(--text-secondary);
		font-weight: 500;
	}

	.avatar-dot { width: 6px; height: 6px; border-radius: 50%; background: #6366f1; flex-shrink: 0; }

	.chat-link {
		background: rgba(99, 102, 241, 0.1);
		color: #6366f1;
		border: none;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.chat-link:hover { background: rgba(99, 102, 241, 0.18); }

	:global(.app.light) .chat-link { background: rgba(99, 102, 241, 0.08); color: #4f46e5; }
	:global(.app.light) .chat-link:hover { background: rgba(99, 102, 241, 0.15); }

	.working-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #10b981;
		animation: pulse-dot 1.5s ease-in-out infinite;
		box-shadow: 0 0 4px rgba(16, 185, 129, 0.5);
	}

	@keyframes pulse-dot {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.5; transform: scale(0.8); }
	}

	:global(.app.light) .specs-bar { border-color: var(--border-subtle); }
	:global(.app.light) .spec-priority, :global(.app.light) .spec-type, :global(.app.light) .spec-human { background: rgba(0, 0, 0, 0.04); }
	:global(.app.light) .spec-agent { background: rgba(16, 185, 129, 0.08); }
</style>
