<script lang="ts">
	import type { AgentSession } from '$lib/wsStore.svelte';
	import { formatCwdForDisplay } from '$lib/utils/agent-queue-helpers';

	interface Props {
		session: AgentSession;
	}

	let { session }: Props = $props();
</script>

<div class="running-agent">
	<div class="running-indicator"></div>
	<div class="running-content">
		<div class="running-header">
			<span class="ticket-id">{session.ticketId || 'No ticket'}</span>
		</div>
		<div class="agent-name">{session.name}</div>
		<div class="cwd" title={session.cwd}>{formatCwdForDisplay(session.cwd)}</div>
		<div class="progress-bar">
			<div class="progress-pulse"></div>
		</div>
	</div>
</div>

<style>
	.running-agent {
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--surface-elevated);
		border: 1px solid var(--success-border);
		border-radius: var(--radius-md);
		transition: all var(--transition-smooth);
	}

	.running-indicator {
		flex-shrink: 0;
		width: 0.5rem;
		height: 0.5rem;
		background: var(--success-text);
		border-radius: 50%;
		margin-top: 0.25rem;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.5;
			transform: scale(0.9);
		}
	}

	.running-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.running-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.ticket-id {
		font-weight: 600;
		color: var(--text-primary);
		font-size: 0.875rem;
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

	.progress-bar {
		margin-top: 0.25rem;
		height: 2px;
		background: var(--border-default);
		border-radius: 1px;
		overflow: hidden;
		position: relative;
	}

	.progress-pulse {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		width: 30%;
		background: var(--success-text);
		border-radius: 1px;
		animation: progress-pulse 2s ease-in-out infinite;
	}

	@keyframes progress-pulse {
		0% {
			left: 0%;
			width: 30%;
		}
		50% {
			left: 35%;
			width: 30%;
		}
		100% {
			left: 70%;
			width: 30%;
		}
	}
</style>
