<script lang="ts">
	import type { Pane } from '$lib/wsStore.svelte';
	import { getManagerVisible, toggleManagerVisibility, isManagerSession } from '$lib/stores/manager.svelte';

	interface Props {
		wsPanes: Map<string, Pane>;
		expandedPanes: Set<string>;
		currentProjectPath: string;
		managerEnabled: boolean;
		managerSession: Pane | null;
		onstartmanager?: () => void;
		getUnreadCount: (name: string) => number;
		onremovepane: (name: string) => void;
	}

	let {
		wsPanes,
		expandedPanes = $bindable(),
		currentProjectPath,
		managerEnabled,
		managerSession,
		onstartmanager,
		getUnreadCount,
		onremovepane
	}: Props = $props();

	function togglePaneExpanded(name: string) {
		if (expandedPanes.has(name)) {
			expandedPanes.delete(name);
		} else {
			expandedPanes.add(name);
		}
		expandedPanes = new Set(expandedPanes);
	}
</script>

<div class="agent-tabs">
	{#if managerEnabled}
		<button
			class="manager-toggle"
			class:active={getManagerVisible()}
			class:streaming={managerSession?.streaming}
			onclick={() => {
				if (managerSession) {
					toggleManagerVisibility();
				} else {
					onstartmanager?.();
				}
			}}
			title={getManagerVisible() ? 'Hide manager' : 'Show manager'}
		>
			<span class="manager-dot" class:live={managerSession?.streaming}></span>
			<span class="manager-toggle-label">Manager</span>
		</button>
	{/if}
	{#each [...wsPanes.values()].filter(p => !isManagerSession(p.name) && (p.projectCwd ?? p.cwd) === currentProjectPath) as pane}
		{@const unread = getUnreadCount(pane.name)}
		{@const isExpanded = expandedPanes.has(pane.name)}
		<div class="agent-tab-wrapper" class:active={isExpanded}>
			<button
				class="agent-tab"
				class:active={isExpanded}
				class:streaming={pane.streaming}
				class:unread={unread > 0}
				onclick={() => togglePaneExpanded(pane.name)}
			>
				<span class="tab-dot" class:live={pane.streaming}></span>
				<span class="tab-name">{pane.name}</span>
				{#if unread > 0}
					<span class="tab-unread">{unread > 99 ? '99+' : unread}</span>
				{:else if pane.messages.length > 0}
					<span class="tab-count">{pane.messages.length}</span>
				{/if}
			</button>
			{#if isExpanded}
				<button
					class="tab-close"
					onclick={(e) => { e.stopPropagation(); onremovepane(pane.name); }}
					title="Close {pane.name}"
				>
					<svg viewBox="0 0 10 10" width="8" height="8">
						<path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
				</button>
			{/if}
		</div>
	{/each}
</div>

<style>
	/* ===== Agent Tabs ===== */
	.agent-tabs {
		display: flex;
		gap: 4px;
		flex: 1 1 0;
		min-width: 0;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.agent-tabs::-webkit-scrollbar { display: none; }

	.agent-tab-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		border-radius: 5px;
		transition: background 80ms ease;
	}

	.agent-tab-wrapper.active {
		background: rgba(99, 102, 241, 0.12);
	}

	.agent-tab-wrapper.active:hover {
		background: rgba(99, 102, 241, 0.16);
	}

	:global(.app.light) .agent-tab-wrapper.active { background: rgba(99, 102, 241, 0.1); }
	:global(.app.light) .agent-tab-wrapper.active:hover { background: rgba(99, 102, 241, 0.14); }

	.agent-tab {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 26px;
		padding: 0 10px;
		background: transparent;
		border: none;
		border-radius: 5px;
		color: var(--text-tertiary);
		font: 500 11px/1 'IBM Plex Mono', ui-monospace, monospace;
		cursor: pointer;
		transition: all 80ms ease;
		white-space: nowrap;
	}

	.agent-tab-wrapper:not(.active) .agent-tab:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary);
	}

	.agent-tab.active {
		color: var(--text-primary);
		padding-right: 4px;
	}

	.agent-tab.streaming { color: var(--text-primary); }

	:global(.app.light) .agent-tab-wrapper:not(.active) .agent-tab:hover { background: rgba(0, 0, 0, 0.05); }

	.tab-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		margin-right: 4px;
		background: transparent;
		border: none;
		border-radius: 5px;
		color: var(--text-tertiary);
		cursor: pointer;
		opacity: 0.6;
		transition: all 80ms ease;
	}

	.tab-close:hover {
		background: rgba(239, 68, 68, 0.2);
		color: #f87171;
		opacity: 1;
	}

	:global(.app.light) .tab-close:hover {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}

	.tab-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: currentColor;
		opacity: 0.4;
		flex-shrink: 0;
	}

	.tab-dot.live {
		background: #f59e0b;
		opacity: 1;
		box-shadow: 0 0 4px rgba(245, 158, 11, 0.5);
		animation: pulse 1.2s ease-in-out infinite;
	}

	.tab-name {
		max-width: 180px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tab-count {
		font-size: 9px;
		color: var(--text-tertiary);
		opacity: 0.7;
	}

	.agent-tab.active .tab-count {
		color: #6366f1;
		opacity: 1;
	}

	.agent-tab.unread { border-color: rgba(239, 68, 68, 0.4); }

	.tab-unread {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 14px;
		height: 14px;
		padding: 0 4px;
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
		border-radius: 7px;
		font: 700 8px/1 'IBM Plex Mono', ui-monospace, monospace;
		color: #fff;
		letter-spacing: -0.02em;
		box-shadow: 0 1px 2px rgba(239, 68, 68, 0.3);
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	/* ===== Manager Toggle ===== */
	.manager-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 26px;
		padding: 0 10px;
		background: rgba(245, 158, 11, 0.06);
		border: 1px solid rgba(245, 158, 11, 0.15);
		border-radius: 5px;
		color: var(--text-tertiary);
		font: 500 11px/1 system-ui, -apple-system, sans-serif;
		cursor: pointer;
		transition: all 100ms ease;
		flex-shrink: 0;
	}

	.manager-toggle:hover {
		background: rgba(245, 158, 11, 0.12);
		border-color: rgba(245, 158, 11, 0.25);
		color: #f59e0b;
	}

	.manager-toggle.active {
		background: rgba(245, 158, 11, 0.15);
		border-color: rgba(245, 158, 11, 0.3);
		color: #f59e0b;
	}

	.manager-toggle.streaming {
		border-color: rgba(245, 158, 11, 0.4);
	}

	.manager-toggle .manager-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: currentColor;
		opacity: 0.4;
		flex-shrink: 0;
	}

	.manager-toggle .manager-dot.live {
		background: #f59e0b;
		opacity: 1;
		box-shadow: 0 0 4px rgba(245, 158, 11, 0.5);
		animation: pulse 1.2s ease-in-out infinite;
	}

	.manager-toggle-label {
		font: 500 11px/1 system-ui, -apple-system, sans-serif;
	}

	:global(.app.light) .manager-toggle {
		background: rgba(217, 119, 6, 0.05);
		border-color: rgba(217, 119, 6, 0.12);
	}

	:global(.app.light) .manager-toggle:hover {
		background: rgba(217, 119, 6, 0.1);
		border-color: rgba(217, 119, 6, 0.2);
		color: #d97706;
	}

	:global(.app.light) .manager-toggle.active {
		background: rgba(217, 119, 6, 0.12);
		border-color: rgba(217, 119, 6, 0.25);
		color: #d97706;
	}
</style>
