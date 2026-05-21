<script lang="ts">
	import type { Dependency } from '$lib/types';
	import { columns, getDepTypeConfig } from '$lib/utils';
	import Icon from './Icon.svelte';

	type Props = {
		dependencies?: Dependency[];
		dependents?: Dependency[];
		editable?: boolean;
	};
	let { dependencies = [], dependents = [], editable = false }: Props = $props();

	function statusAccent(status: string): string {
		return columns.find((c) => c.status === status)?.accent ?? '#6b7280';
	}
</script>

{#if dependencies.length > 0 || dependents.length > 0}
	<section class="relations">
		<header class="section-head">
			<span class="section-label">Relations</span>
			<span class="section-count mono">{dependencies.length + dependents.length}</span>
		</header>

		<ul class="rel-list">
			{#each dependencies as dep (dep.id)}
				{@const cfg = getDepTypeConfig(dep.dependency_type)}
				<li class="rel" style="--edge: var(--dd-danger);">
					<span class="rel-icon" style="color: {cfg.color};"><Icon name={cfg.icon} size={12} /></span>
					<span class="rel-meta">
						<span class="rel-direction mono">blocked by</span>
						<span class="rel-status-dot" style="background: {statusAccent(dep.status)};"></span>
						<span class="mono rel-id">{dep.id.replace('bk-', '#')}</span>
					</span>
					<span class="rel-title">{dep.title}</span>
					{#if editable}
						<button class="rel-x" title="Unlink"><Icon name="x" size={10} /></button>
					{/if}
				</li>
			{/each}
			{#each dependents as dep (dep.id)}
				{@const cfg = getDepTypeConfig(dep.dependency_type)}
				<li class="rel reverse" style="--edge: var(--dd-agent);">
					<span class="rel-icon" style="color: {cfg.color};"><Icon name={cfg.icon} size={12} /></span>
					<span class="rel-meta">
						<span class="rel-direction mono">blocking</span>
						<span class="rel-status-dot" style="background: {statusAccent(dep.status)};"></span>
						<span class="mono rel-id">{dep.id.replace('bk-', '#')}</span>
					</span>
					<span class="rel-title">{dep.title}</span>
					{#if editable}
						<button class="rel-x" title="Unlink"><Icon name="x" size={10} /></button>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.relations {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.section-head {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}
	.section-label {
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--dd-fg-3);
		font-weight: 500;
	}
	.section-count {
		font-size: 10.5px;
		color: var(--dd-fg-4);
	}

	.rel-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
		background: var(--dd-bg-2);
		border: 1px solid var(--dd-border-1);
		border-radius: var(--dd-r-2);
		overflow: hidden;
	}
	.rel {
		position: relative;
		display: grid;
		grid-template-columns: auto auto 1fr auto;
		align-items: center;
		gap: 10px;
		padding: 8px 10px 8px 14px;
		background: var(--dd-bg-1);
		font-size: 12px;
		transition: background 80ms;
	}
	.rel:hover {
		background: var(--dd-bg-3);
	}
	.rel:hover .rel-x {
		opacity: 1;
	}
	.rel::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--edge);
	}
	.rel-icon {
		display: inline-flex;
	}
	.rel-meta {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--dd-fg-3);
	}
	.rel-direction {
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.rel-status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}
	.rel-id {
		font-size: 11px;
		color: var(--dd-fg-2);
	}
	.rel-title {
		color: var(--dd-fg-1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
	.rel-x:hover {
		color: var(--dd-fg-1);
		background: var(--dd-bg-4);
	}
</style>
