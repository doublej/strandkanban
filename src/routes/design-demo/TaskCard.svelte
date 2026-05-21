<script lang="ts">
	import type { Issue, Dependency } from '$lib/types';
	import { getPriorityConfig, getTypeIcon, isAgentAssignee, hasOpenBlockers, formatTimestamp } from '$lib/utils';
	import { columns } from '$lib/utils';
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

	const priorityCfg = $derived(getPriorityConfig(issue.priority));
	const typeIcon = $derived(getTypeIcon(issue.issue_type));
	const isAgent = $derived(isAgentAssignee(issue.assignee));
	const blocked = $derived(hasOpenBlockers(issue));

	const created = $derived(formatTimestamp(issue.created_at));
	const closed = $derived(formatTimestamp(issue.closed_at));

	const labelOverflow = $derived(Math.max((issue.labels?.length ?? 0) - 3, 0));

	function agentState(): 'working' | 'assigned' | 'done' {
		if (issue.status === 'in_progress') return 'working';
		if (issue.status === 'closed') return 'done';
		return 'assigned';
	}

	function statusAccent(status: string): string {
		return columns.find((c) => c.status === status)?.accent ?? '#6b7280';
	}

	let copied = $state(false);
	async function copyId(e: MouseEvent) {
		e.stopPropagation();
		await navigator.clipboard.writeText(issue.id);
		copied = true;
		setTimeout(() => (copied = false), 1200);
	}
</script>

<button
	type="button"
	class="card"
	class:selected
	class:blocked
	class:closed={issue.status === 'closed'}
	style="--stripe: {blocked ? 'var(--dd-danger)' : priorityCfg.color};"
	onclick={() => onopen?.(issue.id)}
>
	<span class="stripe"></span>

	<header class="head">
		<span class="pri-dot" style="background: {priorityCfg.color};"></span>
		<span class="seq mono">#{issue.seq}</span>
		{#if pinned}
			<span class="pin-icon" title="Pinned"><Icon name="pin" size={11} /></span>
		{/if}

		<span class="head-spacer"></span>

		<span class="copy-btn" title="Copy ID" onclick={copyId} onkeydown={(e) => e.key === 'Enter' && copyId(e as unknown as MouseEvent)} role="button" tabindex="-1">
			<Icon name={copied ? 'check' : 'copy'} size={11} />
		</span>

		<span class="signals">
			{#if impact >= 40}
				<span class="signal impact" class:critical={impact >= 60} title="Impact score {impact}">
					<Icon name="lightning" size={10} />
					<span class="mono">{impact}</span>
				</span>
			{/if}
			{#if blocked}
				<span class="signal blocked-flag" title="Has open blockers"><Icon name="dep-blocks" size={11} /></span>
			{/if}
			{#if worktree}
				<span class="signal worktree-flag" title="Running in worktree"><Icon name="tree" size={11} /></span>
			{/if}
			{#if (issue.dependency_count || issue.dependents?.length) && !blocked}
				<span class="signal deps-flag" title="Has dependencies">
					<Icon name="link" size={10} />
					<span class="mono">{(issue.dependency_count ?? 0) + (issue.dependent_count ?? 0)}</span>
				</span>
			{/if}
		</span>
	</header>

	{#if isAgent && issue.assignee}
		<div class="agent-chip" class:working={agentState() === 'working'} class:done={agentState() === 'done'}>
			{#if agentState() === 'working'}
				<span class="pulse-dot"></span>
				<span class="agent-name mono">{issue.assignee}</span>
				<span class="agent-state">working</span>
			{:else if agentState() === 'done'}
				<Icon name="check" size={10} />
				<span class="agent-name mono">{issue.assignee}</span>
				<span class="agent-state">done</span>
			{:else}
				<Icon name="agent" size={10} />
				<span class="agent-name mono">{issue.assignee}</span>
				<span class="agent-state">assigned</span>
			{/if}
		</div>
	{/if}

	<h3 class="title">{issue.title}</h3>

	{#if issue.description}
		<p class="desc">{issue.description}</p>
	{/if}

	{#if issue.labels && issue.labels.length > 0}
		<div class="labels">
			{#each issue.labels.slice(0, 3) as label}
				<span class="label">{label}</span>
			{/each}
			{#if labelOverflow > 0}
				<span class="label more">+{labelOverflow}</span>
			{/if}
		</div>
	{/if}

	{#if issue.assignee && !isAgent}
		<div class="human-row">
			<span class="human-dot"></span>
			<span class="human-name">{issue.assignee}</span>
		</div>
	{/if}

	{#if (issue.dependencies && issue.dependencies.length > 0) || (issue.dependents && issue.dependents.length > 0)}
		<div class="depmap">
			{#if issue.dependencies && issue.dependencies.length > 0}
				<div class="depmap-row">
					<span class="depmap-arrow mono">←</span>
					{#each issue.dependencies as dep (dep.id)}
						<span class="dep-id mono" style="--edge: {statusAccent(dep.status)};">{dep.id.replace('bk-', '#')}</span>
					{/each}
				</div>
			{/if}
			{#if issue.dependents && issue.dependents.length > 0}
				<div class="depmap-row">
					<span class="depmap-arrow mono">→</span>
					{#each issue.dependents as dep (dep.id)}
						<span class="dep-id mono" style="--edge: {statusAccent(dep.status)};">{dep.id.replace('bk-', '#')}</span>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<footer class="foot">
		<span class="foot-time mono">
			{created.relative}
			{#if closed.relative}
				<span class="arrow">→</span>
				{closed.relative}
			{/if}
		</span>
		<span class="foot-spacer"></span>
		<span class="foot-type">
			<Icon name={typeIcon} size={10} />
			<span>{issue.issue_type}</span>
		</span>
	</footer>
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
		padding: 10px 12px 8px 14px;
		box-shadow: var(--dd-shadow-1);
		transition: transform 120ms cubic-bezier(0.2, 0.6, 0.2, 1), border-color 120ms, box-shadow 120ms;
		overflow: hidden;
	}
	.card:hover {
		transform: translateY(-1px);
		border-color: var(--dd-border-2);
		box-shadow: var(--dd-shadow-2);
	}
	.card:hover .copy-btn {
		opacity: 1;
	}
	.card.selected {
		border-color: var(--dd-accent);
		box-shadow: 0 0 0 1px var(--dd-accent), 0 6px 20px rgba(59, 130, 246, 0.18);
	}
	.card.blocked {
		border-color: color-mix(in srgb, var(--dd-danger) 35%, var(--dd-border-1));
	}
	.card.closed {
		opacity: 0.72;
	}

	.stripe {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background: var(--stripe);
		opacity: 0.85;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 6px;
		color: var(--dd-fg-3);
	}
	.pri-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex: 0 0 7px;
	}
	.seq {
		font-size: 11px;
		color: var(--dd-fg-3);
	}
	.pin-icon {
		display: inline-flex;
		color: var(--dd-warn);
	}
	.head-spacer {
		flex: 1;
	}
	.copy-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 3px;
		color: var(--dd-fg-3);
		opacity: 0;
		transition: opacity 120ms, color 120ms, background 120ms;
	}
	.copy-btn:hover {
		color: var(--dd-fg-1);
		background: var(--dd-bg-3);
	}

	.signals {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	.signal {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		height: 18px;
		padding: 0 5px;
		border-radius: 3px;
		font-size: 10.5px;
		background: var(--dd-bg-3);
		color: var(--dd-fg-2);
	}
	.signal.impact {
		color: var(--dd-warn);
		background: color-mix(in srgb, var(--dd-warn) 14%, var(--dd-bg-2));
	}
	.signal.impact.critical {
		color: var(--dd-danger);
		background: color-mix(in srgb, var(--dd-danger) 16%, var(--dd-bg-2));
		animation: pulse 1.6s ease-in-out infinite;
	}
	.signal.blocked-flag {
		color: var(--dd-danger);
		background: color-mix(in srgb, var(--dd-danger) 14%, var(--dd-bg-2));
	}
	.signal.worktree-flag {
		color: var(--dd-worktree);
		background: color-mix(in srgb, var(--dd-worktree) 14%, var(--dd-bg-2));
	}
	.signal.deps-flag {
		color: var(--dd-fg-2);
	}

	.agent-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin: 0 0 7px;
		padding: 3px 7px 3px 8px;
		border-radius: var(--dd-r-2);
		background: color-mix(in srgb, var(--dd-human) 14%, var(--dd-bg-2));
		color: color-mix(in srgb, var(--dd-human) 50%, var(--dd-fg-1));
		font-size: 11px;
		border: 1px solid color-mix(in srgb, var(--dd-human) 28%, var(--dd-border-1));
	}
	.agent-chip.working {
		background: color-mix(in srgb, var(--dd-agent) 14%, var(--dd-bg-2));
		color: color-mix(in srgb, var(--dd-agent) 60%, var(--dd-fg-1));
		border-color: color-mix(in srgb, var(--dd-agent) 38%, var(--dd-border-1));
	}
	.agent-chip.done {
		opacity: 0.6;
	}
	.agent-name {
		font-weight: 500;
		font-size: 11px;
	}
	.agent-state {
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--dd-fg-3);
	}
	.pulse-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--dd-agent);
		box-shadow: 0 0 0 0 currentColor;
		animation: pulse 1.4s ease-in-out infinite;
	}

	.title {
		margin: 0 0 4px;
		font-size: 13.5px;
		font-weight: 500;
		line-height: 1.35;
		color: var(--dd-fg-1);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.desc {
		margin: 0 0 8px;
		font-size: 12px;
		line-height: 1.45;
		color: var(--dd-fg-3);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.labels {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 6px;
	}
	.label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 2px 5px;
		border-radius: 3px;
		background: var(--dd-bg-3);
		color: var(--dd-fg-2);
	}
	.label.more {
		background: transparent;
		color: var(--dd-fg-3);
	}

	.human-row {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin-bottom: 6px;
		font-size: 11px;
		color: var(--dd-fg-2);
	}
	.human-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--dd-human);
	}

	.depmap {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-bottom: 6px;
	}
	.depmap-row {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 10.5px;
		color: var(--dd-fg-3);
	}
	.depmap-arrow {
		color: var(--dd-fg-4);
	}
	.dep-id {
		position: relative;
		padding: 1px 5px 1px 7px;
		border-radius: 3px;
		background: var(--dd-bg-3);
		color: var(--dd-fg-2);
		font-size: 10.5px;
	}
	.dep-id::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--edge);
		border-radius: 2px 0 0 2px;
	}

	.foot {
		display: flex;
		align-items: center;
		gap: 6px;
		padding-top: 6px;
		border-top: 1px dashed var(--dd-border-1);
		font-size: 10.5px;
		color: var(--dd-fg-3);
	}
	.foot-spacer {
		flex: 1;
	}
	.foot-time .arrow {
		color: var(--dd-fg-4);
		margin: 0 4px;
	}
	.foot-type {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		opacity: 0.55;
		text-transform: lowercase;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.55; }
	}
</style>
