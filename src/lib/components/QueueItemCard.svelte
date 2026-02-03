<script lang="ts">
	import { formatCwdForDisplay } from '$lib/utils/agent-queue-helpers';

	interface AgentQueueItem {
		ticketId: string;
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
		onCancel: () => void;
	}

	let { item, position, draggable = true, ondragstart, ondragover, ondrop, onCancel }: Props = $props();
</script>

<div
	class="queue-item"
	draggable={draggable}
	ondragstart={ondragstart}
	ondragover={ondragover}
	ondrop={ondrop}
>
	<div class="position-badge">{position}</div>
	<div class="queue-item-content">
		<div class="queue-item-header">
			<span class="ticket-id">{item.ticketId}</span>
			<button class="cancel-btn" onclick={onCancel} title="Cancel">×</button>
		</div>
		<div class="agent-name">{item.agentName}</div>
		<div class="cwd" title={item.cwd}>{formatCwdForDisplay(item.cwd)}</div>
	</div>
</div>

<style>
	.queue-item {
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--surface-elevated);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		cursor: grab;
		transition: all var(--transition-smooth);
	}

	.queue-item:hover {
		background: var(--surface-hover);
		border-color: var(--border-hover);
	}

	.queue-item:active {
		cursor: grabbing;
	}

	.position-badge {
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-primary);
		color: white;
		border-radius: 50%;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.queue-item-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.queue-item-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.ticket-id {
		font-weight: 600;
		color: var(--text-primary);
		font-size: 0.875rem;
	}

	.cancel-btn {
		flex-shrink: 0;
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 1.25rem;
		line-height: 1;
		border-radius: var(--radius-sm);
		transition: all var(--transition-smooth);
	}

	.cancel-btn:hover {
		background: var(--danger-bg);
		color: var(--danger-text);
	}

	.agent-name {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.cwd {
		font-size: 0.6875rem;
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
