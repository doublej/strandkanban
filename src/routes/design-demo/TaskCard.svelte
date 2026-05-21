<script lang="ts">
	import type { Issue } from '$lib/types';
	import { getPriorityConfig, isAgentAssignee, hasOpenBlockers, formatTimestamp } from '$lib/utils';
	import Icon from './Icon.svelte';

	type Props = {
		issue: Issue;
		pinned?: boolean;
		worktree?: boolean;
		impact?: number;
		selected?: boolean;
		onopen?: (id: string) => void;
	};
	let { issue, pinned = false, worktree = false, impact = 0, selected = false, onopen }: Props = $props();

	const pri = $derived(getPriorityConfig(issue.priority));
	const isAgent = $derived(isAgentAssignee(issue.assignee));
	const blocked = $derived(hasOpenBlockers(issue));
	const blockerCount = $derived(issue.dependencies?.filter((d) => d.status !== 'closed').length ?? 0);
	const created = $derived(formatTimestamp(issue.created_at));

	const agentWorking = $derived(isAgent && issue.status === 'in_progress');
	const critical = $derived(issue.priority <= 1);
	const hot = $derived(impact >= 60);

	// One "fiber" wins: blocked > working > hot > none
	const fiber = $derived(blocked ? 'blocked' : agentWorking ? 'working' : hot ? 'hot' : null);
	const fiberColor = $derived(
		fiber === 'blocked' ? 'var(--dd-danger)'
		: fiber === 'working' ? 'var(--dd-agent)'
		: fiber === 'hot' ? 'var(--dd-warn)'
		: 'transparent'
	);
</script>

<button
	type="button"
	class="card"
	class:selected
	class:has-fiber={!!fiber}
	class:closed={issue.status === 'closed'}
	style="--fiber: {fiberColor};"
	onclick={() => onopen?.(issue.id)}
>
	{#if fiber}
		<span class="fiber"></span>
	{/if}

	<div class="title-row">
		{#if critical}
			<span class="pri-mark" style="background: {pri.color};" title={pri.label}></span>
		{/if}
		<h3 class="title">{issue.title}</h3>
	</div>

	<div class="foot">
		<span class="foot-id mono">#{issue.seq}</span>
		<span class="foot-sep">·</span>
		<span class="foot-time mono">{created.relative}</span>
		{#if blocked}
			<span class="foot-sep">·</span>
			<span class="foot-blockers mono" title="{blockerCount} open blocker{blockerCount === 1 ? '' : 's'}">
				← {blockerCount}
			</span>
		{/if}
		{#if pinned}
			<span class="foot-pin" title="Pinned"><Icon name="pin" size={9} /></span>
		{/if}

		<span class="foot-spacer"></span>

		{#if agentWorking}
			<span class="foot-agent working" title="{issue.assignee} working">
				<span class="pulse"></span>
				<span class="mono">{issue.assignee?.replace(/^agent-/, '')}</span>
			</span>
		{:else if isAgent && issue.assignee}
			<span class="foot-agent" title={issue.assignee}>
				<Icon name="agent" size={10} />
			</span>
		{:else if issue.assignee}
			<span class="foot-human" title={issue.assignee}>
				<span class="human-dot"></span>
			</span>
		{/if}

		{#if worktree}
			<span class="foot-worktree" title="Worktree active"><Icon name="tree" size={10} /></span>
		{/if}
	</div>
</button>

<style>
	.card {
		position: relative;
		display: block;
		width: 100%;
		text-align: left;
		background: var(--dd-bg-1);
		border: 1px solid var(--dd-border-1);
		border-radius: var(--dd-r-2);
		padding: 10px 12px;
		box-shadow: var(--dd-shadow-1);
		transition: transform 100ms cubic-bezier(0.2, 0.6, 0.2, 1), border-color 100ms, box-shadow 100ms;
	}
	.card:hover {
		transform: translateY(-1px);
		border-color: var(--dd-border-3);
		box-shadow: var(--dd-shadow-2);
	}
	.card.selected {
		border-color: var(--dd-accent);
		box-shadow: 0 0 0 1px var(--dd-accent), 0 4px 12px rgba(37, 99, 235, 0.12);
	}
	.card.has-fiber {
		padding-left: 14px;
	}
	.card.closed { opacity: 0.72; }
	.card.closed .title { text-decoration: line-through; text-decoration-color: var(--dd-fg-4); }

	.fiber {
		position: absolute;
		left: 0;
		top: 6px;
		bottom: 6px;
		width: 2px;
		background: var(--fiber);
		border-radius: 0 1px 1px 0;
	}

	.title-row {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		margin-bottom: 8px;
	}
	.pri-mark {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		margin-top: 7px;
		flex: 0 0 5px;
	}
	.title {
		margin: 0;
		font-size: 13.5px;
		font-weight: 500;
		line-height: 1.4;
		letter-spacing: -0.01em;
		color: var(--dd-fg-1);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.foot {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 10.5px;
		color: var(--dd-fg-3);
	}
	.foot-id, .foot-time { color: var(--dd-fg-3); }
	.foot-sep { color: var(--dd-fg-4); }
	.foot-blockers { color: var(--dd-danger); font-weight: 500; }
	.foot-pin { display: inline-flex; color: var(--dd-warn); margin-left: 1px; }
	.foot-spacer { flex: 1; }

	.foot-agent {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--dd-fg-3);
	}
	.foot-agent.working {
		color: var(--dd-agent);
		font-weight: 500;
	}
	.pulse {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--dd-agent);
		animation: pulse 1.4s ease-in-out infinite;
	}

	.foot-human {
		display: inline-flex;
	}
	.human-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--dd-human);
	}

	.foot-worktree {
		display: inline-flex;
		color: var(--dd-worktree);
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.5; transform: scale(0.7); }
	}
</style>
