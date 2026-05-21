<script lang="ts">
	import type { Issue } from '$lib/types';
	import { columns } from '$lib/utils';
	import Icon from './Icon.svelte';

	type Props = { issue: Issue };
	let { issue }: Props = $props();

	const blockers = $derived(issue.dependencies ?? []);
	const dependents = $derived(issue.dependents ?? []);
	const hasLinks = $derived(blockers.length > 0 || dependents.length > 0);

	function statusAccent(s: string): string {
		return columns.find((c) => c.status === s)?.accent ?? '#6b7280';
	}
	function isOpen(s: string): boolean { return s !== 'closed'; }
</script>

{#if hasLinks}
	{#if blockers.length > 0}
		<div class="branch">
			<header class="branch-head">
				<span class="label">{blockers.length} blocker{blockers.length === 1 ? '' : 's'}</span>
			</header>
			<ul class="rel-list">
				{#each blockers as dep (dep.id)}
					<li class="rel">
						<span class="dot" class:is-ring={!isOpen(dep.status)} style="color: {statusAccent(dep.status)}; background: {isOpen(dep.status) ? statusAccent(dep.status) : 'var(--surf-1)'};"></span>
						<span class="mono rel-id">#{dep.id.replace(/^bk-0*/, '')}</span>
						<span class="rel-title" class:is-done={!isOpen(dep.status)}>{dep.title}</span>
						<button class="icon-btn rel-x" title="Unlink"><Icon name="x" size={12} /></button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="self">
		<span class="dot self-mark"></span>
		<span class="mono rel-id">#{issue.id.replace(/^bk-0*/, '')}</span>
		<span class="label self-label">this issue</span>
	</div>

	{#if dependents.length > 0}
		<div class="branch">
			<header class="branch-head">
				<span class="label">blocks {dependents.length}</span>
			</header>
			<ul class="rel-list">
				{#each dependents as dep (dep.id)}
					<li class="rel">
						<span class="dot" class:is-ring={!isOpen(dep.status)} style="color: {statusAccent(dep.status)}; background: {isOpen(dep.status) ? statusAccent(dep.status) : 'var(--surf-1)'};"></span>
						<span class="mono rel-id">#{dep.id.replace(/^bk-0*/, '')}</span>
						<span class="rel-title" class:is-done={!isOpen(dep.status)}>{dep.title}</span>
						<button class="icon-btn rel-x" title="Unlink"><Icon name="x" size={12} /></button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
{:else}
	<button class="ctrl is-sm ghost">
		<Icon name="link" size={12} />
		<span>Link an issue…</span>
	</button>
{/if}

<style>
	.branch {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
	}
	.branch-head {
		padding-left: var(--sp-6);
	}

	.rel-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	/* Fixed column grid so every relation row aligns vertically */
	.rel,
	.self {
		display: grid;
		grid-template-columns: var(--sp-4) 36px 1fr var(--ctrl-md);
		column-gap: var(--sp-2);
		align-items: center;
		height: var(--ctrl-lg);
		padding: 0 var(--sp-1) 0 var(--sp-2);
		font-size: var(--fs-sm);
		border-radius: var(--r-sm);
		position: relative;
	}

	.rel:hover { background: var(--surf-2); }
	.rel:hover .rel-x { opacity: 1; }

	/* Connector line between rels */
	.rel::before {
		content: '';
		position: absolute;
		left: calc(var(--sp-2) + 7px);
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--line-2);
	}
	.rel:first-child::before { top: 50%; }
	.rel:last-child::before { bottom: 50%; }
	.rel::after {
		content: '';
		position: absolute;
		left: calc(var(--sp-2) + 7px);
		top: 50%;
		width: var(--sp-2);
		height: 1px;
		background: var(--line-2);
	}

	.dot {
		justify-self: end;
		position: relative;
		z-index: 1;
		box-shadow: 0 0 0 2px var(--surf-1);
	}

	.rel-id {
		font-size: var(--fs-xs);
		color: var(--ink-3);
	}
	.rel-title {
		color: var(--ink-1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.rel-title.is-done {
		text-decoration: line-through;
		text-decoration-color: var(--ink-4);
		color: var(--ink-3);
	}
	.rel-x {
		opacity: 0;
		transition: opacity 120ms;
	}

	.self {
		margin: var(--sp-2) 0;
	}
	.self-mark {
		justify-self: end;
		background: var(--accent);
		box-shadow: 0 0 0 2px var(--surf-1), 0 0 0 3px var(--accent);
	}
	.self-label {
		font-size: 10px;
		color: var(--ink-4);
	}

	.ghost {
		color: var(--ink-4);
		border: 1px dashed var(--line-2);
		align-self: flex-start;
	}
	.ghost:hover {
		color: var(--ink-2);
		border-color: var(--line-3);
	}
</style>
