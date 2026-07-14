<script lang="ts">
	import type { Issue } from '$lib/types';
	import { columns, getPriorityConfig, getTypeIcon } from '$lib/utils';
	import Icon from './Icon.svelte';

	interface Props {
		issues: Issue[];
		selectedId?: string | null;
		isDark?: boolean;
		onselect?: (issue: Issue) => void;
	}

	let { issues, selectedId = null, isDark = true, onselect }: Props = $props();

	// Group issues by status
	const groupedByStatus = $derived.by(() => {
		const groups = new Map<string, Issue[]>();
		for (const col of columns) {
			groups.set(col.status, []);
		}
		for (const issue of issues) {
			const list = groups.get(issue.status);
			if (list) list.push(issue);
		}
		return groups;
	});

	// Calculate grid dimensions based on largest group
	const maxPerGroup = $derived(Math.max(...Array.from(groupedByStatus.values()).map(g => g.length), 1));

	// Responsive block size based on total issues
	const blockSize = $derived.by(() => {
		const total = issues.length;
		if (total > 500) return 8;
		if (total > 300) return 10;
		if (total > 150) return 12;
		if (total > 75) return 16;
		return 20;
	});

	const gap = $derived(blockSize > 12 ? 3 : 2);

	function handleBlockClick(issue: Issue) {
		onselect?.(issue);
	}

	function handleKeydown(e: KeyboardEvent, issue: Issue) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onselect?.(issue);
		}
	}

	// Calculate columns per row based on available width
	const columnsPerRow = $derived.by(() => {
		// Estimate: aim for roughly square groups when possible
		const idealCols = Math.ceil(Math.sqrt(maxPerGroup));
		return Math.max(idealCols, 6);
	});
</script>

<div class="grid-view" class:dark={isDark}>
	{#if issues.length === 0}
		<div class="grid-empty">No tickets to display</div>
	{:else}
		<div class="grid-canvas">
			{#each columns as column}
				{@const columnIssues = groupedByStatus.get(column.status) ?? []}
				{#if columnIssues.length > 0}
					<div class="status-group">
						<div class="group-header" style="--accent: {column.accent}">
							<Icon name={column.icon} size={12} />
							<span class="group-label">{column.label}</span>
							<span class="group-count">{columnIssues.length}</span>
						</div>
						<div
							class="blocks-grid"
							style="--block-size: {blockSize}px; --gap: {gap}px; --cols: {columnsPerRow}"
						>
							{#each columnIssues as issue (issue.id)}
								{@const priorityConfig = getPriorityConfig(issue.priority)}
								{@const isSelected = issue.id === selectedId}
								<button
									class="block"
									class:selected={isSelected}
									style="--priority-color: {priorityConfig.color}; --status-accent: {column.accent}"
									onclick={() => handleBlockClick(issue)}
									onkeydown={(e) => handleKeydown(e, issue)}
									title="{issue.id}: {issue.title}"
								>
									<span class="block-inner"></span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>

		<div class="grid-legend">
			<div class="legend-section">
				<span class="legend-title">Priority</span>
				<div class="legend-items">
					{#each [0, 1, 2, 3, 4] as p}
						{@const config = getPriorityConfig(p)}
						<div class="legend-item">
							<span class="legend-swatch" style="background: {config.color}"></span>
							<span class="legend-label">{config.label}</span>
						</div>
					{/each}
				</div>
			</div>
			<div class="legend-section">
				<span class="legend-title">Status</span>
				<div class="legend-items">
					{#each columns as col}
						<div class="legend-item">
							<span class="legend-swatch status-swatch" style="border-color: {col.accent}"></span>
							<span class="legend-label">{col.label}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.grid-view {
		flex: 1;
		min-width: 0;
		min-height: 0;
		position: relative;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--surface-base, var(--surface-panel));
	}

	.grid-empty {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-tertiary);
		font-size: 0.8125rem;
	}

	.grid-canvas {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: 1.5rem;
		padding: 1.25rem;
		overflow: auto;
	}

	.status-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 120px;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0;
		color: var(--accent);
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.group-label {
		color: var(--text-secondary);
	}

	.group-count {
		margin-left: auto;
		padding: 0.125rem 0.375rem;
		background: var(--surface-elevated);
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
		font-size: 0.625rem;
		font-weight: 500;
	}

	.blocks-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), var(--block-size));
		gap: var(--gap);
	}

	.block {
		width: var(--block-size);
		height: var(--block-size);
		padding: 0;
		border: 1px solid transparent;
		border-radius: 2px;
		background: transparent;
		cursor: pointer;
		transition: transform 0.1s, box-shadow 0.1s;
		position: relative;
	}

	.block-inner {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 1px;
		background: var(--priority-color);
		opacity: 0.85;
		transition: opacity 0.1s;
	}

	.block:hover {
		transform: scale(1.3);
		z-index: 10;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.block:hover .block-inner {
		opacity: 1;
	}

	.block.selected {
		border-color: var(--text-primary);
		transform: scale(1.4);
		z-index: 11;
		box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 4px var(--status-accent);
	}

	.block:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 2px;
	}

	/* Legend */
	.grid-legend {
		display: flex;
		gap: 2rem;
		padding: 0.75rem 1.25rem;
		background: var(--surface-panel);
		border-top: 1px solid var(--border-subtle);
	}

	.legend-section {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.legend-title {
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary);
	}

	.legend-items {
		display: flex;
		gap: 0.75rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.legend-swatch {
		width: 8px;
		height: 8px;
		border-radius: 2px;
	}

	.legend-swatch.status-swatch {
		background: transparent;
		border: 2px solid;
	}

	.legend-label {
		font-size: 0.625rem;
		color: var(--text-secondary);
	}

	/* Light mode adjustments */
	:global(.app.light) .block:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}
</style>
