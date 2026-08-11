import { browser } from '$app/environment';
import { connect, disconnect, getPanes, getSessions, isConnected, type Pane } from '$lib/wsStore.svelte';
import type { SdkSessionInfo } from '$lib/wsStore.svelte';
import { isValidSession as isValidSessionFn } from '$lib/agent/ticket-delivery';
import { getManagerSessionName } from '$lib/stores/manager.svelte';
import { createPaneDrag } from '$lib/stores/pane-drag.svelte';
import { settings } from '$lib/stores/settings.svelte';

export interface AgentPanesContext {
	getCurrentProjectPath: () => string;
}

/** Agent pane bookkeeping: the WS pane snapshot plus the per-pane UI state around it. */
export function createAgentPanes(ctx: AgentPanesContext) {
	let wsConnected = $state(false);
	let wsPanes = $state<Map<string, Pane>>(new Map());
	let showActivityBar = $state(true);
	let chatBarReserve = $state(64);
	let newPaneName = $state('');
	let resumePrompt = $state<{ name: string; sessionId: string } | null>(null);
	let showSessionPicker = $state(false);
	let sdkSessions = $state<SdkSessionInfo[]>([]);
	let loadingSdkSessions = $state(false);
	let sessionSearchQuery = $state('');
	let paneMessageInputs = $state<Record<string, string>>({});
	let expandedPanes = $state<Set<string>>(new Set());

	const paneDrag = createPaneDrag();

	let lastPanesJson = '';

	// Deliberate coalescer, NOT a candidate for `$derived(getPanes())`: updateSession
	// reassigns the sessions Map on every streamed token, so a derived would re-render
	// the whole agent bar per token. The 100ms JSON diff collapses that to 10 fps.
	$effect(() => {
		const poll = () => {
			wsConnected = isConnected();
			const newPanes = getPanes();
			const newJson = JSON.stringify([...newPanes.entries()].map(([k, v]) => [k, v.messages.length, v.currentDelta?.length || 0, v.streaming]));
			if (newJson !== lastPanesJson) {
				lastPanesJson = newJson;
				wsPanes = newPanes;
			}
		};
		poll();
		const id = setInterval(poll, 100);
		return () => clearInterval(id);
	});

	$effect(() => {
		if (browser && settings.agentEnabled) connect();
		return () => disconnect();
	});

	$effect(() => {
		showActivityBar = settings.showAgentBar;
	});

	$effect(() => paneDrag.setupListeners());

	const filteredSessions = $derived(sdkSessions.filter(isValidSessionFn));
	const searchedSessions = $derived.by(() => {
		const q = sessionSearchQuery.trim().toLowerCase();
		if (!q) return filteredSessions;
		return filteredSessions.filter(s =>
			(s.agentName?.toLowerCase().includes(q)) ||
			(s.summary?.toLowerCase().includes(q)) ||
			s.preview.some(line => line.toLowerCase().includes(q))
		);
	});
	const activeAgentNames = $derived([...wsPanes.keys()]);
	const managerSession = $derived.by(() => {
		const path = ctx.getCurrentProjectPath();
		if (!path) return null;
		return wsPanes.get(getManagerSessionName(path)) ?? null;
	});
	const runningAgents = $derived.by(() => {
		const sessions = Array.from(getSessions().values());
		return sessions.filter(s => s.ticketId && !s.ended && (s.projectCwd ?? s.cwd) === ctx.getCurrentProjectPath());
	});
	const worktreeTicketIds = $derived.by(() => {
		const ids = new Set<string>();
		for (const s of runningAgents) {
			if (s.worktreePath && s.ticketId) ids.add(s.ticketId);
		}
		return ids;
	});

	function toggleActivityBar() {
		showActivityBar = !showActivityBar;
		settings.showAgentBar = showActivityBar;
	}

	return {
		get wsConnected() { return wsConnected; },
		get wsPanes() { return wsPanes; },
		get showActivityBar() { return showActivityBar; },
		get chatBarReserve() { return chatBarReserve; },
		set chatBarReserve(v: number) { chatBarReserve = v; },
		get newPaneName() { return newPaneName; },
		set newPaneName(v: string) { newPaneName = v; },
		get resumePrompt() { return resumePrompt; },
		set resumePrompt(v: { name: string; sessionId: string } | null) { resumePrompt = v; },
		get showSessionPicker() { return showSessionPicker; },
		set showSessionPicker(v: boolean) { showSessionPicker = v; },
		get sdkSessions() { return sdkSessions; },
		set sdkSessions(v: SdkSessionInfo[]) { sdkSessions = v; },
		get loadingSdkSessions() { return loadingSdkSessions; },
		set loadingSdkSessions(v: boolean) { loadingSdkSessions = v; },
		get sessionSearchQuery() { return sessionSearchQuery; },
		set sessionSearchQuery(v: string) { sessionSearchQuery = v; },
		get paneMessageInputs() { return paneMessageInputs; },
		set paneMessageInputs(v: Record<string, string>) { paneMessageInputs = v; },
		get expandedPanes() { return expandedPanes; },
		set expandedPanes(v: Set<string>) { expandedPanes = v; },
		get filteredSessions() { return filteredSessions; },
		get searchedSessions() { return searchedSessions; },
		get activeAgentNames() { return activeAgentNames; },
		get managerSession() { return managerSession; },
		get runningAgents() { return runningAgents; },
		get worktreeTicketIds() { return worktreeTicketIds; },
		get paneSizes() { return paneDrag.paneSizes; },
		get panePositions() { return paneDrag.panePositions; },
		get paneCustomSizes() { return paneDrag.paneCustomSizes; },
		get draggingPane() { return paneDrag.draggingPane; },
		get resizingPane() { return paneDrag.resizingPane; },
		cyclePaneSize: paneDrag.cyclePaneSize,
		startDrag: paneDrag.startDrag,
		startResize: paneDrag.startResize,
		toggleActivityBar
	};
}

export type AgentPanes = ReturnType<typeof createAgentPanes>;
