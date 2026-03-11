<script lang="ts">

	interface AgentQueueItem {
		ticketId: string;
		title: string;
		description?: string;
		agentName: string;
		cwd: string;
	}

	interface Props {
		item: AgentQueueItem;
		position: number;
		draggable?: boolean;
		ondragstart?: (e: DragEvent) => void;
		ondragover?: (e: DragEvent) => void;
		ondrop?: (e: DragEvent) => void;
		ondragend?: () => void;
		onCancel: () => void;
	}

	let { item, position, draggable = true, ondragstart, ondragover, ondrop, ondragend, onCancel }: Props = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="queue-item"
	role="listitem"
	draggable={draggable}
	ondragstart={ondragstart}
	ondragover={ondragover}
	ondrop={ondrop}
	ondragend={ondragend}
>
	<div class="position-badge">{position}</div>
	<div class="queue-item-content">
		<div class="queue-item-header">
			<span class="ticket-id">{item.ticketId}</span>
			<button class="cancel-btn" onclick={onCancel} title="Cancel">×</button>
		</div>
		<div class="item-title" title={item.title}>{item.title}</div>
		{#if item.description}
			<div class="item-description" title={item.description}>{item.description}</div>
		{/if}
	</div>
</div>

<style>
	.queue-item {
		position: relative;
		display: flex;
		gap: 0.625rem;
		padding: 0.5rem 0.625rem;
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		cursor: grab;
		transition: all var(--transition-fast);
	}

	.queue-item::before {
		content: '';
		position: absolute;
		top: 0.5rem;
		left: 0;
		width: 2px;
		height: calc(100% - 1rem);
		border-radius: 0 1px 1px 0;
		background: #f59e0b;
		opacity: 0.6;
	}

	.queue-item:hover {
		background: var(--surface-elevated);
		border-color: var(--border-default);
		transform: translateY(-1px);
	}

	.queue-item:active {
		cursor: grabbing;
		transform: scale(0.99);
	}

	.position-badge {
		flex-shrink: 0;
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
		border-radius: var(--radius-xs);
		font: 600 10px/1 var(--font-mono);
	}

	.queue-item-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.queue-item-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.ticket-id {
		font: 550 12px/1.2 var(--font-sans);
		color: var(--text-primary);
	}

	.cancel-btn {
		flex-shrink: 0;
		width: 1.125rem;
		height: 1.125rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		border-radius: var(--radius-xs);
		opacity: 0;
		transition: all var(--transition-fast);
	}

	.queue-item:hover .cancel-btn {
		opacity: 1;
	}

	.cancel-btn:hover {
		background: rgba(239, 68, 68, 0.12);
		color: #ef4444;
	}

	.item-title {
		font: 500 11px/1.3 var(--font-sans);
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.item-description {
		font: 400 10px/1.4 var(--font-sans);
		color: var(--text-tertiary);
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	/* Light theme adjustments */
	:global(.app.light) .queue-item {
		box-shadow: var(--shadow-sm);
	}

	:global(.app.light) .queue-item:hover {
		box-shadow: var(--shadow-md);
	}
</style>
