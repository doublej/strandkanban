<script lang="ts">
	import AgentBar from '$lib/components/AgentBar.svelte';
	import { connect, disconnect, addPane, removePane, sendToPane, endSession, clearSession, continueSession, compactSession, interrupt, getPersistedSdkSessionId, fetchSdkSessions, markPaneAsRead, getTotalUnreadCount, getUnreadCount } from '$lib/wsStore.svelte';
	import { startManager } from '$lib/stores/ws-connection.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import type { LoadingStatus } from '$lib/types';
	import type { PageOps } from '$lib/stores/page-ops.svelte';
	import type { AgentPanes } from '$lib/stores/agent-panes.svelte';
	import type { ProjectSession } from '$lib/stores/project-session.svelte';

	interface Props {
		agentPanes: AgentPanes;
		ops: PageOps;
		session: ProjectSession;
		loadingStatus: LoadingStatus;
		isDarkMode: boolean;
	}

	let { agentPanes, ops, session, loadingStatus, isDarkMode }: Props = $props();

	async function startAgentServer() {
		try {
			await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) });
		} catch (err) {
			console.error('Failed to start agent server:', err);
		}
	}

	async function restartAgentServer() {
		try {
			disconnect();
			await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restart' }) });
			setTimeout(() => connect(), 800);
		} catch (err) {
			console.error('Failed to restart agent server:', err);
		}
	}
</script>

<AgentBar
	wsConnected={agentPanes.wsConnected}
	showActivityBar={agentPanes.showActivityBar}
	wsPanes={agentPanes.wsPanes}
	bind:expandedPanes={agentPanes.expandedPanes}
	bind:newPaneName={agentPanes.newPaneName}
	bind:resumePrompt={agentPanes.resumePrompt}
	bind:showSessionPicker={agentPanes.showSessionPicker}
	bind:sdkSessions={agentPanes.sdkSessions}
	bind:loadingSdkSessions={agentPanes.loadingSdkSessions}
	bind:sessionSearchQuery={agentPanes.sessionSearchQuery}
	filteredSessions={agentPanes.filteredSessions}
	searchedSessions={agentPanes.searchedSessions}
	paneSizes={agentPanes.paneSizes}
	panePositions={agentPanes.panePositions}
	paneCustomSizes={agentPanes.paneCustomSizes}
	bind:paneMessageInputs={agentPanes.paneMessageInputs}
	draggingPane={agentPanes.draggingPane}
	resizingPane={agentPanes.resizingPane}
	{loadingStatus}
	agentEnabled={settings.agentEnabled}
	{isDarkMode}
	agentToolsExpanded={settings.agentToolsExpanded}
	currentProjectPath={session.currentProjectPath}
	agentFirstMessage={settings.agentFirstMessage}
	combinedSystemPrompt={settings.combinedSystemPrompt}
	agentSystemPrompt={settings.agentSystemPrompt}
	{getPersistedSdkSessionId}
	{getUnreadCount}
	{getTotalUnreadCount}
	extractTicketIdFromName={ops.extractTicketIdFromName}
	onaddpane={addPane}
	onremovepane={removePane}
	onsendtopane={sendToPane}
	onstartagentserver={startAgentServer}
	onrestartagentserver={restartAgentServer}
	onfetchsdksessions={fetchSdkSessions}
	onendSession={endSession}
	onclearSession={clearSession}
	oncontinueSession={continueSession}
	oncompactSession={compactSession}
	onmarkPaneAsRead={markPaneAsRead}
	onopenTicketFromPane={ops.openTicketFromPane}
	oninterrupt={interrupt}
	managerEnabled={settings.managerEnabled}
	managerSession={agentPanes.managerSession}
	onstartmanager={() => startManager(session.currentProjectPath)}
	onstartDrag={agentPanes.startDrag}
	onstartResize={agentPanes.startResize}
	oncyclePaneSize={agentPanes.cyclePaneSize}
	onhandleMouseMove={ops.handleMouseMove}
	onhandleMouseUp={ops.handleMouseUp}
	onbasesizechange={(px) => agentPanes.chatBarReserve = px}
/>
