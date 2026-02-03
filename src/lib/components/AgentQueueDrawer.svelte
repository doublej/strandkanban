<script lang="ts">
	import type { AgentSession } from '$lib/wsStore.svelte';
	import QueueItemCard from './QueueItemCard.svelte';
	import RunningAgentCard from './RunningAgentCard.svelte';

	interface AgentQueueItem {
		ticketId: string;
		agentName: string;
		cwd: string;
	}

	interface Props {
		queue: AgentQueueItem[];
		runningSessions: AgentSession[];
		onCancel: (ticketId: string) => void;
		onReorder: (fromIndex: number, toIndex: number) => void;
	}

	let { queue, runningSessions, onCancel, onReorder }: Props = $props();

	let isExpanded = $state(false);
	let draggedIndex = $state<number | null>(null);

	// Auto-expand on first queue item
	$effect(() => {
		if (queue.length > 0 && !isExpanded) {
			isExpanded = true;
		}
	});

	function handleDragStart(e: DragEvent, index: number) {
		draggedIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', index.toString());
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDrop(e: DragEvent, targetIndex: number) {
		e.preventDefault();
		if (draggedIndex !== null && draggedIndex !== targetIndex) {
			onReorder(draggedIndex, targetIndex);
		}
		draggedIndex = null;
	}

	function handleDragEnd() {
		draggedIndex = null;
	}
</script>

{#if !isExpanded}
	<button class="queue-badge" onclick={() => isExpanded = true} title="Agent Queue">
		<span class="count">{queue.length}</span>
		{#if queue.length > 0}
			<span class="pulse"></span>
		{/if}
	</button>
{/if}

{#if isExpanded}
	<div class="drawer">
		<div class="drawer-header">
			<h3>Agent Queue</h3>
			<button class="minimize-btn" onclick={() => isExpanded = false} title="Minimize">−</button>
		</div>

		<div class="drawer-body">
			{#if runningSessions.length > 0}
				<div class="section">
					<h4 class="section-title">Running ({runningSessions.length})</h4>
					<div class="section-content">
						{#each runningSessions as session (session.id)}
							<RunningAgentCard {session} />
						{/each}
					</div>
				</div>
			{/if}

			{#if queue.length > 0}
				<div class="section">
					<h4 class="section-title">Queued ({queue.length})</h4>
					<div class="section-content">
						{#each queue as item, i (item.ticketId)}
							<QueueItemCard
								{item}
								position={i + 1}
								draggable={true}
								ondragstart={(e) => handleDragStart(e, i)}
								ondragover={handleDragOver}
								ondrop={(e) => handleDrop(e, i)}
								ondragend={handleDragEnd}
								onCancel={() => onCancel(item.ticketId)}
							/>
						{/each}
					</div>
				</div>
			{:else if runningSessions.length === 0}
				<div class="empty-state">
					<p>Queue is empty</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.queue-badge {
		position: fixed;
		bottom: 1rem;
		left: 1rem;
		z-index: 9998;
		width: 48px;
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface-elevated);
		border: 2px solid var(--accent-primary);
		border-radius: 50%;
		cursor: pointer;
		box-shadow: var(--shadow-elevated);
		transition: all var(--transition-smooth);
		position: relative;
	}

	.queue-badge:hover {
		transform: scale(1.05);
		box-shadow: var(--shadow-elevated-hover);
	}

	.count {
		font-weight: 700;
		color: var(--accent-primary);
		font-size: 1.125rem;
	}

	.pulse {
		position: absolute;
		top: -2px;
		right: -2px;
		width: 12px;
		height: 12px;
		background: var(--accent-primary);
		border-radius: 50%;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.5;
			transform: scale(0.8);
		}
	}

	.drawer {
		position: fixed;
		bottom: 1rem;
		left: 1rem;
		z-index: 9998;
		width: 360px;
		max-height: 80vh;
		background: var(--surface-elevated);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-elevated);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: slideInLeft 250ms var(--ease-out);
	}

	@keyframes slideInLeft {
		from {
			transform: translateX(-100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	.drawer-header {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid var(--border-default);
	}

	.drawer-header h3 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.minimize-btn {
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 1.5rem;
		line-height: 1;
		border-radius: var(--radius-sm);
		transition: all var(--transition-smooth);
	}

	.minimize-btn:hover {
		background: var(--surface-hover);
		color: var(--text-primary);
	}

	.drawer-body {
		flex: 1;
		overflow-y: auto;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.section-title {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
		margin: 0;
		padding: 0 0.25rem;
	}

	.section-content {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.empty-state {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.empty-state p {
		color: var(--text-tertiary);
		font-size: 0.875rem;
		margin: 0;
	}

	@media (max-width: 768px) {
		.drawer {
			width: calc(100vw - 2rem);
			max-height: 50vh;
		}
	}
</style>
