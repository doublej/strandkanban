<script lang="ts">
	import type { Issue, Dependency } from '$lib/types';
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
	function isOpen(s: string): boolean {
		return s !== 'closed';
	}
</script>

<section class="links">
	{#if hasLinks}
		{#if blockers.length > 0}
			<div class="branch up">
				<div class="branch-label">
					<span class="mono">{blockers.length}</span> blocker{blockers.length === 1 ? '' : 's'}
				</div>
				<ul class="rel-list">
					{#each blockers as dep (dep.id)}
						<li class="rel">
							<span class="rel-dot" class:closed={!isOpen(dep.status)} style="--accent: {statusAccent(dep.status)};"></span>
							<span class="mono rel-id">#{dep.id.replace(/^bk-0*/, '')}</span>
							<span class="rel-title" class:done={!isOpen(dep.status)}>{dep.title}</span>
							<button class="rel-x" title="Unlink"><Icon name="x" size={10} /></button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<div class="self">
			<span class="self-mark"></span>
			<span class="mono self-id">#{issue.id.replace(/^bk-0*/, '')}</span>
			<span class="self-label">this issue</span>
		</div>

		{#if dependents.length > 0}
			<div class="branch down">
				<div class="branch-label">
					blocks <span class="mono">{dependents.length}</span>
				</div>
				<ul class="rel-list">
					{#each dependents as dep (dep.id)}
						<li class="rel">
							<span class="rel-dot" class:closed={!isOpen(dep.status)} style="--accent: {statusAccent(dep.status)};"></span>
							<span class="mono rel-id">#{dep.id.replace(/^bk-0*/, '')}</span>
							<span class="rel-title" class:done={!isOpen(dep.status)}>{dep.title}</span>
							<button class="rel-x" title="Unlink"><Icon name="x" size={10} /></button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{:else}
		<button class="links-empty">
			<Icon name="link" size={12} />
			<span>Link an issue…</span>
		</button>
	{/if}
</section>

<style>
	.links {
		display: flex;
		flex-direction: column;
	}

	.branch {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 4px 0;
	}
	.branch-label {
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--dd-fg-3);
		font-weight: 500;
		padding: 0 0 2px 16px;
	}
	.branch-label .mono { color: var(--dd-fg-1); font-weight: 600; }

	.rel-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.rel {
		position: relative;
		display: grid;
		grid-template-columns: 16px auto 1fr auto;
		gap: 8px;
		align-items: center;
		padding: 5px 4px 5px 16px;
		font-size: 12px;
		border-radius: 3px;
		transition: background 80ms;
	}
	.rel::before {
		content: '';
		position: absolute;
		left: 5px;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--dd-border-2);
	}
	.rel:first-child::before { top: 12px; }
	.rel:last-child::before { bottom: 12px; }
	.rel::after {
		content: '';
		position: absolute;
		left: 5px;
		top: 50%;
		width: 9px;
		height: 1px;
		background: var(--dd-border-2);
	}
	.rel:hover { background: var(--dd-bg-2); }
	.rel:hover .rel-x { opacity: 1; }

	.rel-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		justify-self: end;
		position: relative;
		z-index: 1;
		box-shadow: 0 0 0 2px var(--dd-bg-1);
	}
	.rel-dot.closed {
		background: var(--dd-bg-1);
		border: 1.5px solid var(--accent);
	}
	.rel-id {
		font-size: 11px;
		color: var(--dd-fg-3);
		min-width: 36px;
	}
	.rel-title {
		color: var(--dd-fg-1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.rel-title.done {
		text-decoration: line-through;
		text-decoration-color: var(--dd-fg-4);
		color: var(--dd-fg-3);
	}
	.rel-x {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 3px;
		color: var(--dd-fg-3);
		opacity: 0;
		transition: opacity 120ms, background 80ms;
	}
	.rel-x:hover { color: var(--dd-fg-1); background: var(--dd-bg-3); }

	.self {
		position: relative;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 4px 8px 16px;
		font-size: 12px;
		color: var(--dd-fg-2);
	}
	.self-mark {
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%);
		width: 11px;
		height: 11px;
		border-radius: 50%;
		background: var(--dd-accent);
		box-shadow: 0 0 0 3px var(--dd-bg-1), 0 0 0 4px var(--dd-accent);
	}
	.self-id {
		font-size: 11px;
		color: var(--dd-fg-2);
		font-weight: 600;
	}
	.self-label {
		font-size: 11px;
		color: var(--dd-fg-4);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.links-empty {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		font-size: 12px;
		color: var(--dd-fg-4);
		border: 1px dashed var(--dd-border-2);
		border-radius: var(--dd-r-2);
		align-self: flex-start;
		transition: color 80ms, border-color 80ms;
	}
	.links-empty:hover {
		color: var(--dd-fg-2);
		border-color: var(--dd-border-3);
	}
</style>
