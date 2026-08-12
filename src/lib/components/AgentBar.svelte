<script lang="ts">
	import type { Pane, SdkSessionInfo, ChatImage } from '$lib/wsStore.svelte';
	import type { LoadingStatus } from '$lib/types';
	import PaneActivity from './PaneActivity.svelte';
	import StatusBar from './StatusBar.svelte';
	import AgentBarSessionPicker from './AgentBarSessionPicker.svelte';
	import AgentLauncher from './AgentLauncher.svelte';
	import AgentTabs from './AgentTabs.svelte';
	import { isManagerSession } from '$lib/stores/manager.svelte';
	import { browser } from '$app/environment';

	interface Props {
		wsConnected: boolean;
		showActivityBar: boolean;
		wsPanes: Map<string, Pane>;
		expandedPanes: Set<string>;
		newPaneName: string;
		resumePrompt: { name: string; sessionId: string } | null;
		showSessionPicker: boolean;
		sdkSessions: SdkSessionInfo[];
		loadingSdkSessions: boolean;
		sessionSearchQuery: string;
		filteredSessions: SdkSessionInfo[];
		searchedSessions: SdkSessionInfo[];
		paneSizes: Record<string, 'compact' | 'medium' | 'large'>;
		panePositions: Record<string, { x: number; y: number }>;
		paneCustomSizes: Record<string, { w: number; h: number }>;
		paneMessageInputs: Record<string, string>;
		draggingPane: string | null;
		resizingPane: string | null;
		loadingStatus: LoadingStatus;
		agentEnabled: boolean;
		isDarkMode: boolean;
		agentToolsExpanded: boolean;
		currentProjectPath: string;
		agentFirstMessage: string;
		combinedSystemPrompt: string;
		agentSystemPrompt: string;
		// Callbacks
		getPersistedSdkSessionId: (name: string) => string | undefined;
		getUnreadCount: (name: string) => number;
		getTotalUnreadCount: () => number;
		extractTicketIdFromName: (name: string) => string | undefined;
		onaddpane: (name: string, projectPath: string, firstMsg: string, systemPrompt: string, sessionId?: string, ticketId?: string) => void;
		onremovepane: (name: string) => void;
		onsendtopane: (name: string, msg: string, projectPath: string, images?: ChatImage[]) => void;
		onstartagentserver: () => void;
		onrestartagentserver: () => void;
		onfetchsdksessions: (projectPath: string) => Promise<SdkSessionInfo[]>;
		onendSession: (name: string) => void;
		onclearSession: (name: string) => void;
		oncontinueSession: (name: string) => void;
		oncompactSession: (name: string) => void;
		onmarkPaneAsRead: (name: string) => void;
		onopenTicketFromPane: (ticketId: string) => void;
		oninterrupt?: (name: string) => void;
		managerEnabled: boolean;
		managerSession: Pane | null;
		onstartmanager?: () => void;
		onstartDrag: (e: MouseEvent, name: string) => void;
		onstartResize: (e: MouseEvent, name: string, edge: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') => void;
		oncyclePaneSize: (name: string) => void;
		onhandleMouseMove: (e: MouseEvent) => void;
		onhandleMouseUp: () => void;
		/** Reports the collapsed bar's footprint (px from viewport bottom to its top edge). */
		onbasesizechange?: (px: number) => void;
	}

	let {
		wsConnected,
		showActivityBar,
		wsPanes,
		expandedPanes = $bindable(),
		newPaneName = $bindable(),
		resumePrompt = $bindable(),
		showSessionPicker = $bindable(),
		sdkSessions = $bindable(),
		loadingSdkSessions = $bindable(),
		sessionSearchQuery = $bindable(),
		filteredSessions,
		searchedSessions,
		paneSizes,
		panePositions,
		paneCustomSizes,
		paneMessageInputs = $bindable(),
		draggingPane,
		resizingPane,
		loadingStatus,
		agentEnabled,
		isDarkMode,
		agentToolsExpanded,
		currentProjectPath,
		agentFirstMessage,
		combinedSystemPrompt,
		agentSystemPrompt,
		getPersistedSdkSessionId,
		getUnreadCount,
		getTotalUnreadCount,
		extractTicketIdFromName,
		onaddpane,
		onremovepane,
		onsendtopane,
		onstartagentserver,
		onrestartagentserver,
		onfetchsdksessions,
		onendSession,
		onclearSession,
		oncontinueSession,
		oncompactSession,
		onmarkPaneAsRead,
		onopenTicketFromPane,
		oninterrupt,
		managerEnabled,
		managerSession,
		onstartmanager,
		onstartDrag,
		onstartResize,
		oncyclePaneSize,
		onhandleMouseMove,
		onhandleMouseUp,
		onbasesizechange,
	}: Props = $props();

	const nonManagerPaneCount = $derived(
		[...wsPanes.values()].filter(p => !isManagerSession(p.name) && (p.projectCwd ?? p.cwd) === currentProjectPath).length
	);

	// Report the collapsed bar's footprint so the layout can reserve matching space.
	let stripEl = $state<HTMLDivElement | null>(null);
	$effect(() => {
		if (!browser || !stripEl) return;
		const el = stripEl;
		const measure = () => onbasesizechange?.(Math.max(0, window.innerHeight - el.getBoundingClientRect().top));
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		window.addEventListener('resize', measure);
		return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
	});

	function handleSessionSelect(session: SdkSessionInfo) {
		const name = session.agentName || session.sessionId.slice(0, 8);
		const ticketId = extractTicketIdFromName(name);
		onaddpane(name, currentProjectPath, agentFirstMessage, agentSystemPrompt, session.sessionId, ticketId);
		expandedPanes.add(name);
		expandedPanes = new Set(expandedPanes);
		showSessionPicker = false;
	}
</script>

{#if wsConnected && showActivityBar}
<div class="agent-bar" class:has-panes={wsPanes.size > 0}>
	<div class="agent-bar-inner" bind:this={stripEl}>
		<AgentLauncher
			bind:newPaneName
			bind:resumePrompt
			bind:showSessionPicker
			bind:sdkSessions
			bind:loadingSdkSessions
			bind:sessionSearchQuery
			bind:expandedPanes
			{filteredSessions}
			{currentProjectPath}
			{agentFirstMessage}
			{combinedSystemPrompt}
			{agentSystemPrompt}
			{getPersistedSdkSessionId}
			{onaddpane}
			{onfetchsdksessions}
		/>

		<AgentTabs
			{wsPanes}
			bind:expandedPanes
			{currentProjectPath}
			{managerEnabled}
			{managerSession}
			{onstartmanager}
			{getUnreadCount}
			{onremovepane}
		/>
		<div class="agent-bar-status">
			<StatusBar
				dataStatus={loadingStatus}
				agentConnected={wsConnected}
				agentCount={nonManagerPaneCount}
				unreadCount={getTotalUnreadCount()}
				{agentEnabled}
				light={!isDarkMode}
				onstartAgent={onstartagentserver}
				onrestartAgent={onrestartagentserver}
			/>
		</div>
	</div>

	<PaneActivity
		{wsPanes}
		{expandedPanes}
		{paneSizes}
		{panePositions}
		{paneCustomSizes}
		bind:paneMessageInputs
		{draggingPane}
		{resizingPane}
		disabled={!wsConnected}
		toolsExpandedByDefault={agentToolsExpanded}
		{getUnreadCount}
		onStartDrag={onstartDrag}
		onStartResize={onstartResize}
		onCyclePaneSize={oncyclePaneSize}
		onRemovePane={onremovepane}
		onMinimizePane={(name) => { expandedPanes.delete(name); expandedPanes = new Set(expandedPanes); }}
		onSendMessage={(name, msg, images) => onsendtopane(name, msg, currentProjectPath, images)}
		onMouseMove={onhandleMouseMove}
		onMouseUp={onhandleMouseUp}
		onEndSession={onendSession}
		onClearSession={onclearSession}
		onContinueSession={(name) => {
			const pane = wsPanes.get(name);
			const sessionId = pane?.sdkSessionId || getPersistedSdkSessionId(name);
			if (sessionId) {
				onremovepane(name);
				const ticketId = pane?.ticketId ?? extractTicketIdFromName(name);
				onaddpane(name, currentProjectPath, agentFirstMessage, agentSystemPrompt, sessionId, ticketId);
				expandedPanes.add(name);
				expandedPanes = new Set(expandedPanes);
			} else {
				oncontinueSession(name);
			}
		}}
		onCompactSession={oncompactSession}
		onFetchSessions={() => onfetchsdksessions(currentProjectPath)}
		onResumeSession={(name, sessionId) => {
			const pane = wsPanes.get(name);
			onremovepane(name);
			const ticketId = pane?.ticketId ?? extractTicketIdFromName(name);
			onaddpane(name, currentProjectPath, agentFirstMessage, agentSystemPrompt, sessionId, ticketId);
			expandedPanes.add(name);
			expandedPanes = new Set(expandedPanes);
		}}
		onMarkAsRead={onmarkPaneAsRead}
		onOpenTicket={onopenTicketFromPane}
		onInterrupt={oninterrupt}
	/>
</div>
{/if}

<AgentBarSessionPicker
	show={showSessionPicker}
	loading={loadingSdkSessions}
	{filteredSessions}
	{searchedSessions}
	{sessionSearchQuery}
	onclose={() => showSessionPicker = false}
	onsearch={(q) => sessionSearchQuery = q}
	onselect={handleSessionSelect}
/>

{#if !wsConnected}
<div class="status-bar-fallback" class:light={!isDarkMode}>
	<StatusBar
		dataStatus={loadingStatus}
		agentConnected={wsConnected}
		agentCount={nonManagerPaneCount}
		unreadCount={getTotalUnreadCount()}
		{agentEnabled}
		light={!isDarkMode}
		onstartAgent={onstartagentserver}
		onrestartAgent={onrestartagentserver}
	/>
</div>
{/if}

<style>
	.agent-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 1000;
		display: flex;
		flex-direction: column-reverse;
		pointer-events: none;
	}

	.agent-bar-inner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 1.25rem 1.25rem;
		padding: 0.5rem 0.75rem;
		background: var(--bg-primary);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		pointer-events: auto;
		box-shadow:
			0 0 0 0.5px rgba(0, 0, 0, 0.4),
			0 2px 8px rgba(0, 0, 0, 0.3);
		animation: expandLeft 250ms ease-out;
	}

	@keyframes expandLeft {
		from { clip-path: inset(0 0 0 100%); opacity: 0; }
		to { clip-path: inset(0 0 0 0); opacity: 1; }
	}

	:global(.app.light) .agent-bar-inner {
		background: var(--bg-primary);
		border-color: rgba(0, 0, 0, 0.1);
		box-shadow:
			0 0 0 0.5px rgba(0, 0, 0, 0.06),
			0 2px 8px rgba(0, 0, 0, 0.08);
	}

	/* Match the board's mobile insets so the bar aligns with content above */
	@media (max-width: 768px) {
		.agent-bar-inner {
			margin-left: max(var(--mobile-padding), env(safe-area-inset-left));
			margin-right: max(var(--mobile-padding), env(safe-area-inset-right));
			margin-bottom: max(var(--mobile-padding), env(safe-area-inset-bottom));
		}
	}

	.agent-bar-status {
		flex-shrink: 0;
	}

	.agent-bar-status :global(.status-bar) {
		background: transparent;
		border: none;
		padding: 0;
	}

	.status-bar-fallback {
		position: fixed;
		bottom: 12px;
		right: 12px;
		z-index: 9999;
	}

</style>
