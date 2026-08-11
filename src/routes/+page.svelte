<script lang="ts">
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
	import { pushState as svelteKitPushState } from '$app/navigation';
	import { setCurrentProject, appendProjectParam } from '$lib/project';
	import { connect, disconnect, getPanes, getSessions, isConnected, addPane, removePane, sendToPane, endSession, clearSession, continueSession, compactSession, interrupt, getPersistedSdkSessionId, fetchSdkSessions, markPaneAsRead, getTotalUnreadCount, getUnreadCount, type Pane, type SdkSessionInfo } from '$lib/wsStore.svelte';
	import type { Issue, Project } from '$lib/types';
	import { getColumnsWithCustom, sortIssuesBy } from '$lib/utils';
	import Header from '$lib/components/Header.svelte';
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import RopeDrag from '$lib/components/RopeDrag.svelte';
	import DepTypePicker from '$lib/components/DepTypePicker.svelte';
	import CwdConflictDialog from '$lib/components/CwdConflictDialog.svelte';
	import KeyboardHelp from '$lib/components/KeyboardHelp.svelte';
	import ZenReview from '$lib/components/ZenReview.svelte';
	import FlyingCardComponent from '$lib/components/FlyingCard.svelte';
	import AgentBar from '$lib/components/AgentBar.svelte';
	import InitialLoader from '$lib/components/InitialLoader.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import QueuePanel from '$lib/components/QueuePanel.svelte';
	import PwaInstallPrompt from '$lib/components/PwaInstallPrompt.svelte';
	import SettingsPane from '$lib/components/SettingsPane.svelte';
	import SetupWizard from '$lib/components/SetupWizard.svelte';
	import ThemeTransition from '$lib/components/ThemeTransition.svelte';
	import ProjectSwitcher from '$lib/components/ProjectSwitcher.svelte';
	import FilterSidebar from '$lib/components/FilterSidebar.svelte';
	import ViewLayout from '$lib/components/ViewLayout.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { notificationStore } from '$lib/notifications/notification-store.svelte';
	import { createPaneDrag } from '$lib/stores/pane-drag.svelte';
	import { isValidSession as isValidSessionFn } from '$lib/agent/ticket-delivery';
	import { createKeyboardNav } from '$lib/keyboard/kanban-nav';
	import { createIssueStore } from '$lib/stores/issue-store.svelte';
	import { createCardDrag } from '$lib/drag-drop/card-drag.svelte';
	import { createPageOps } from '$lib/stores/page-ops.svelte';
	import { createViewState } from '$lib/stores/view-state.svelte';
	import { createZen } from '$lib/stores/zen.svelte';
	import { getManagerSessionName } from '$lib/stores/manager.svelte';
	import { startManager, switchManagerProject, setServerProject } from '$lib/stores/ws-connection.svelte';
	import { getQueueItems, getQueuedTicketIds, fetchInitialQueue } from '$lib/stores/queue.svelte';

	let { data } = $props();

	// --- UI State (page-only) ---
	let isFilterPreviewing = $state(false);
	let selectedId = $state<string | null>(null);
	let activeColumnIndex = $state(0);
	let showActivityBar = $state(true);
	let chatBarReserve = $state(64);
	let newPaneName = $state('');
	let resumePrompt = $state<{ name: string; sessionId: string } | null>(null);
	let showSessionPicker = $state(false);
	let sdkSessions = $state<SdkSessionInfo[]>([]);
	let filteredSessions = $derived(sdkSessions.filter(isValidSessionFn));
	let loadingSdkSessions = $state(false);
	let sessionSearchQuery = $state('');
	let searchedSessions = $derived.by(() => {
		const q = sessionSearchQuery.trim().toLowerCase();
		if (!q) return filteredSessions;
		return filteredSessions.filter(s =>
			(s.agentName?.toLowerCase().includes(q)) ||
			(s.summary?.toLowerCase().includes(q)) ||
			s.preview.some(line => line.toLowerCase().includes(q))
		);
	});
	let paneMessageInputs = $state<Record<string, string>>({});
	let expandedPanes = $state<Set<string>>(new Set());
	let showKeyboardHelp = $state(false);
	let showHotkeys = $state(false);
	let showSettings = $state(false);
	let showWizard = $state(browser && !localStorage.getItem('beads-wizard-complete'));
	let showPrompts = $state(false);
	let projectName = $state('');
	let teleports = $state<{id: string; from: {x: number; y: number; w: number; h: number}; to: {x: number; y: number; w: number; h: number}; startTime: number}[]>([]);
	let placeholders = $state<{id: string; targetColumn: string; height: number}[]>([]);
	let cardRefs = $state<Map<string, HTMLElement>>(new Map());
	let placeholderRefs = $state<Map<string, HTMLElement>>(new Map());
	let flyingCards = $state<Map<string, {from: {x: number; y: number; w: number; h: number}; to: {x: number; y: number; w: number; h: number}; issue: Issue}>>(new Map());
	let shrinkingSourceIds = $state<Set<string>>(new Set());
	let tableSelectedIds = $state<string[]>([]);
	let projects = $state<Project[]>([]);
	let showProjectSwitcher = $state(false);
	let currentProjectPath = $state(data.cwd ?? '');
	let projectColor = $state('#6366f1');
	let projectTransition = $state<'idle' | 'wipe-out' | 'wipe-in'>('idle');
	let switchStatus = $state<string | null>(null);

	// --- Seed frontend project context before any effect fires ---
	// data.cwd already reflects any ?project= param (resolveProjectCwd on the server),
	// so appendProjectParam works on the very first client request — no CWD_MISSING
	// 400s, no SSE-reconnect stall on cold load.
	if (browser && data.cwd) {
		setCurrentProject(data.cwd);
	}

	// --- View preferences (filters, view mode, recipes, theme) ---
	const viewState = createViewState({ getCurrentProjectPath: () => currentProjectPath });

	// Agent queue state
	let runningAgents = $derived.by(() => {
		const sessions = Array.from(getSessions().values());
		return sessions.filter(s => s.ticketId && !s.ended && (s.projectCwd ?? s.cwd) === currentProjectPath);
	});
	let worktreeTicketIds = $derived.by(() => {
		const ids = new Set<string>();
		for (const s of runningAgents) {
			if (s.worktreePath && s.ticketId) ids.add(s.ticketId);
		}
		return ids;
	});
	// --- Issue Store ---
	const issueStore = createIssueStore({
		onNewIssue: () => {}, // Notifications now handled by event system
		onStatusChange: () => {}, // Notifications now handled by event system
		getCardPosition: (id) => {
			const el = cardRefs.get(id);
			if (!el) return null;
			const rect = el.getBoundingClientRect();
			return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
		},
		getPlaceholderPosition: (id) => {
			const el = placeholderRefs.get(id);
			if (!el) return null;
			const rect = el.getBoundingClientRect();
			return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
		},
		measureTargetPosition: (targetColumn, height) => {
			// Find the column element
			const columnEl = document.querySelector(`[data-column-key="${targetColumn}"] .cards`);
			if (!columnEl) return null;

			// Create temporary hidden placeholder
			const tempPlaceholder = document.createElement('div');
			tempPlaceholder.style.height = `${height}px`;
			tempPlaceholder.style.visibility = 'hidden';
			tempPlaceholder.style.position = 'relative';

			// Inject, measure, remove
			columnEl.insertBefore(tempPlaceholder, columnEl.firstChild);
			const rect = tempPlaceholder.getBoundingClientRect();
			const pos = { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
			columnEl.removeChild(tempPlaceholder);
			return pos;
		},
		addPlaceholder: (id, targetColumn, height) => {
			if (!placeholders.some(p => p.id === id)) {
				placeholders = [...placeholders, { id, targetColumn, height }];
			}
		},
		addFlyingCard: (id, from, to, issue) => {
			flyingCards.set(id, { from, to, issue });
			flyingCards = new Map(flyingCards);
		},
		addTeleport: (id, from, to) => {
			teleports = [...teleports, { id, from, to, startTime: Date.now() }];
		},
		addShrinkingSource: (id) => {
			shrinkingSourceIds.add(id);
			shrinkingSourceIds = new Set(shrinkingSourceIds);
		},
		cleanupAnimation: (id) => {
			teleports = teleports.filter(t => t.id !== id);
			placeholders = placeholders.filter(p => p.id !== id);
			flyingCards.delete(id);
			flyingCards = new Map(flyingCards);
			shrinkingSourceIds.delete(id);
			shrinkingSourceIds = new Set(shrinkingSourceIds);
		},
		notifyTicket: (id, message, type, context) => ops.notifyTicket(id, message, type, context),
		onEditingIssueClosedExternally: () => { ops.issueClosedExternally = true; },
		getEditingIssue: () => ops.editingIssue,
		getIsCreating: () => ops.isCreating
	}, data.issues ?? []);

	let issues = $derived(issueStore.issues);
	let statusColumns = $derived(getColumnsWithCustom(issues));
	let animatingIds = $derived(issueStore.animatingIds);
	let loadingStatus = $derived(issueStore.loadingStatus);
	let initialLoaded = $derived(issueStore.initialLoaded);

	// --- Page Operations (detail panel, deps, context menu, agent ops) ---
	const ops = createPageOps({
		issueStore,
		getIssues: () => issues,
		getWsPanes: () => wsPanes,
		getCurrentProjectPath: () => currentProjectPath,
		getSelectedId: () => selectedId,
		setSelectedId: (id) => { selectedId = id; },
		getExpandedPanes: () => expandedPanes,
		setExpandedPanes: (v) => { expandedPanes = v; },
	});

	let serverQueue = $derived(getQueueItems());
	let queuedTicketIds = $derived(getQueuedTicketIds());
	let scopedServerQueue = $derived(serverQueue.filter(item => item.cwd === currentProjectPath));
	let mappedAgentQueue = $derived(scopedServerQueue.map(item => ({
		ticketId: item.ticketId,
		title: item.title,
		description: item.description,
		agentName: item.agentName,
		cwd: item.cwd
	})));
	// --- Card Drag/Drop & Touch ---
	const cardDrag = createCardDrag({
		getIssues: () => issues,
		updateIssue: (id, updates) => issueStore.updateIssue(id, updates),
		getActiveColumnIndex: () => activeColumnIndex,
		setActiveColumnIndex: (idx) => { activeColumnIndex = idx; },
		closePanel: ops.closePanel,
		onQueueDrop: (issueId) => {
			const issue = issues.find(i => i.id === issueId);
			if (issue) ops.startAgentForIssue(issue);
		},
		onQueueItemDropToColumn: (ticketId) => {
			ops.cancelQueueItem(ticketId);
		}
	});

	let draggedOverColumn = $derived(cardDrag.draggedOverColumn);

	// --- Pane Drag ---
	const paneDrag = createPaneDrag();
	const { cyclePaneSize, startDrag, startResize } = paneDrag;
	let paneSizes = $derived(paneDrag.paneSizes);
	let panePositions = $derived(paneDrag.panePositions);
	let paneCustomSizes = $derived(paneDrag.paneCustomSizes);
	let draggingPane = $derived(paneDrag.draggingPane);
	let resizingPane = $derived(paneDrag.resizingPane);
	$effect(() => paneDrag.setupListeners());

	// --- WS Polling ---
	let wsConnected = $state(false);
	let wsPanes = $state<Map<string, Pane>>(new Map());
	let managerSession = $derived.by(() => {
		if (!currentProjectPath) return null;
		const sessionName = getManagerSessionName(currentProjectPath);
		return wsPanes.get(sessionName) ?? null;
	});
	let lastPanesJson = '';

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

	const activeAgentNames = $derived([...wsPanes.keys()]);

	// --- Filters ---
	const availableLabels = $derived([...new Set(issues.flatMap(i => i.labels || []))].sort());
	const availableAssignees = $derived([...new Set(issues.map(i => i.assignee).filter((a): a is string => !!a))].sort());
	const availableTypes = $derived([...new Set(issues.map(i => i.issue_type).filter(Boolean))].sort());
	const filteredIssues = $derived(issues.filter(viewState.matchesFilters));
	// Ordered rows for the table view — the single source of order shared by the
	// table display AND keyboard next/prev, so "next" is always the next visible row.
	const orderedTableIssues = $derived(
		settings.tableSort ? sortIssuesBy(filteredIssues, settings.tableSort.field, settings.tableSort.dir) : filteredIssues
	);

	// --- Zen focus review + deep links ---
	const zen = createZen({
		getIssues: () => issues,
		getFilteredIssues: () => filteredIssues,
		getSelectedId: () => selectedId,
		updateIssue: (id, updates) => ops.updateIssue(id, updates),
		openIssueById: (id, pushState) => ops.openIssueById(id, pushState)
	}, data.zenIssues ?? []);

	// --- Keyboard Nav ---
	const keyboardNav = createKeyboardNav({
		getFilteredIssues: () => filteredIssues,
		getViewMode: () => viewState.viewMode,
		getOrderedVisibleIssues: () => (viewState.viewMode === 'table' ? orderedTableIssues : filteredIssues),
		getSelectedId: () => selectedId,
		setSelectedId: (id) => { selectedId = id; },
		getPanelOpen: () => ops.panelOpen,
		getIsCreating: () => ops.isCreating,
		getShowKeyboardHelp: () => showKeyboardHelp,
		setShowKeyboardHelp: (v) => { showKeyboardHelp = v; },
		getShowHotkeys: () => showHotkeys,
		setShowHotkeys: (v) => { showHotkeys = v; },
		getShowProjectSwitcher: () => showProjectSwitcher,
		setShowProjectSwitcher: (v) => { showProjectSwitcher = v; },
		getOverlayOpen: () => showSettings || showPrompts || showWizard || showProjectSwitcher,
		getProjectCount: () => projects.length,
		createIssue: ops.createIssue,
		openCreatePanel: ops.openCreatePanel,
		openEditPanel: (issue) => { tableSelectedIds = []; ops.openEditPanel(issue); },
		deleteIssue: ops.deleteIssue,
		toggleTheme: viewState.toggleTheme,
		closePanel: ops.closePanel,
		openZenReview: () => zen.openReview()
	});
	const { handleKeydown, handleKeyup, handleWindowBlur } = keyboardNav;

	// --- Helpers ---
	function registerCard(node: HTMLElement, id: string) {
		cardRefs.set(id, node);
		return { destroy() { cardRefs.delete(id); } };
	}

	function registerPlaceholder(node: HTMLElement, id: string) {
		placeholderRefs.set(id, node);
		return { destroy() { placeholderRefs.delete(id); } };
	}

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

	$effect(() => {
		untrack(() => notificationStore.init());
	});

	$effect(() => {
		showActivityBar = settings.showAgentBar;
	});

	// --- Lifecycle effects ---
	$effect(() => {
		untrack(() => issueStore.connectSSE());
		return () => issueStore.closeSse();
	});

	$effect(() => {
		if (browser && settings.agentEnabled) connect();
		return () => disconnect();
	});

	// Keep backend fenced to the current project: re-send set_project whenever
	// connection comes up or the current project changes. Also seed the queue.
	$effect(() => {
		if (!browser) return;
		if (!wsConnected) return;
		if (!currentProjectPath) return;
		setServerProject(currentProjectPath);
		fetchInitialQueue(9347, currentProjectPath);
	});

	async function initProject(urlProject: string | null) {
		let cwd: string;
		let name: string;

		if (urlProject) {
			// URL specifies the project — switch server default to match
			const res = await fetch('/api/cwd', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: urlProject })
			});
			const payload = await res.json();
			const data = payload?.ok ? payload.data : {};
			cwd = data.cwd || urlProject;
			name = data.name || cwd.split('/').pop() || 'project';
		} else {
			// No URL param — get current from server
			const res = await fetch('/api/cwd');
			const payload = await res.json();
			const data = payload?.ok ? payload.data : {};
			cwd = data.cwd;
			name = data.name || cwd.split('/').pop() || 'project';
			setCurrentProject(cwd);
		}

		projectName = name;
		currentProjectPath = cwd;

		const projRes = await fetch('/api/projects', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path: cwd, name })
		});
		const projPayload = await projRes.json();
		const projData = projPayload?.ok ? projPayload.data : {};
		if (projData.projects) {
			projects = projData.projects;
			const current = projects.find((p: Project) => p.path === cwd);
			if (current) {
				projectColor = current.color;
				projectName = current.meta?.title || current.name || name;
			}
		}
	}

	$effect(() => {
		if (!browser) return;
		const urlProject = new URL(window.location.href).searchParams.get('project');
		initProject(urlProject);
	});

	async function switchProject(project: Project) {
		if (project.path === currentProjectPath) return;
		const WIPE_DURATION = 350;
		const targetName = project.meta?.title || project.name;
		switchStatus = `Switching to ${targetName}…`;
		projectTransition = 'wipe-out';
		issueStore.closeSse();

		// Update frontend project context BEFORE API calls so appendProjectParam works
		setCurrentProject(project.path);
		currentProjectPath = project.path;

		// Switch manager to new project (if visible, it will auto-resume or start new session)
		switchManagerProject(project.path);

		// Flip backend fence to new project immediately so broadcasts filter correctly.
		setServerProject(project.path);
		fetchInitialQueue(9347, project.path);

		const [cwdRes] = await Promise.all([
			fetch('/api/cwd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: project.path }) }),
			new Promise(r => setTimeout(r, WIPE_DURATION))
		]);
		if (!cwdRes.ok) { projectTransition = 'idle'; switchStatus = null; return; }
		switchStatus = 'Loading issues…';
		const issuesRes = await fetch(appendProjectParam('/api/issues'));
		const issuesPayload = await issuesRes.json();
		const issuesData = issuesPayload?.ok ? issuesPayload.data : { issues: [] };
		issueStore.setIssues(issuesData.issues || []);
		projectName = project.meta?.title || project.name;
		projectColor = project.color;
		issueStore.initialLoaded = true;
		selectedId = null;
		tableSelectedIds = [];
		ops.editingIssue = null;
		ops.isCreating = false;
		projectTransition = 'wipe-in';
		switchStatus = null;
		issueStore.connectSSE();

		// Update URL to include project param
		const url = new URL(window.location.href);
		url.searchParams.set('project', project.path);
		url.searchParams.delete('issue');
		svelteKitPushState(url.pathname + url.search, { project: project.path });

		await new Promise(r => setTimeout(r, WIPE_DURATION));
		projectTransition = 'idle';
	}

	function handlePopState(e: PopStateEvent) {
		const url = new URL(window.location.href);
		const urlProject = url.searchParams.get('project');
		if (urlProject && urlProject !== currentProjectPath) {
			const project = projects.find(p => p.path === urlProject);
			if (project) switchProject(project);
			return;
		}
		ops.handlePopState(e);
	}

	// --- Table bulk actions ---
	async function bulkUpdateIssues(ids: string[], updates: Partial<Issue>) {
		for (const id of ids) await ops.updateIssue(id, updates);
	}
	async function bulkDeleteIssues(ids: string[]) {
		for (const id of ids) await ops.deleteIssue(id);
	}
</script>

<svelte:window onkeydown={handleKeydown} onkeyup={handleKeyup} onpopstate={handlePopState} onclick={ops.closeContextMenu} onmousemove={ops.handleMouseMove} onmouseup={ops.handleMouseUp} onblur={handleWindowBlur} />

<div class="app scheme-{viewState.colorScheme}" class:light={!viewState.isDarkMode} class:panel-open={ops.panelOpen} class:show-hotkeys={showHotkeys || settings.alwaysShowHotkeys} class:has-chat-bar={wsConnected && showActivityBar} style="--project-color: {projectColor}; --chat-bar-space: {chatBarReserve}px">

{#if ops.contextMenu}
	<ContextMenu
		x={ops.contextMenu.x}
		y={ops.contextMenu.y}
		issue={ops.contextMenu.issue}
		onSetPriority={(p) => ops.setIssuePriority(ops.contextMenu.issue.id, p)}
		onStartRopeDrag={(e) => ops.startRopeDrag(e, ops.contextMenu.issue.id)}
		onClose={ops.closeContextMenu}
	/>
{/if}

<RopeDrag ropeDrag={ops.ropeDrag} />

<DepTypePicker pendingDep={ops.pendingDep} onconfirm={ops.confirmDependency} oncancel={ops.cancelDependency} />

<CwdConflictDialog conflict={ops.cwdConflict} onresolve={ops.resolveConflict} ondismiss={ops.dismissConflict} />

<ThemeTransition
	active={viewState.themeTransitionActive}
	toLight={viewState.themeTransitionToLight}
	onswitch={viewState.switchTheme}
	ondone={viewState.completeThemeTransition}
/>

<ProjectSwitcher
	bind:show={showProjectSwitcher}
	{projects}
	currentPath={currentProjectPath}
	onselect={switchProject}
	onclose={() => showProjectSwitcher = false}
/>

<KeyboardHelp bind:show={showKeyboardHelp} />
<SetupWizard bind:show={showWizard} isDarkMode={viewState.isDarkMode} {projectName} ontoggleTheme={viewState.toggleTheme} oncomplete={() => {}} />
<SettingsPane
	bind:show={showSettings}
	bind:showPrompts
	bind:agentEnabled={settings.agentEnabled}
	bind:agentHost={settings.agentHost}
	bind:agentPort={settings.agentPort}
	bind:agentFirstMessage={settings.agentFirstMessage}
	bind:agentSystemPrompt={settings.agentSystemPrompt}
	bind:agentWorkflow={settings.agentWorkflow}
	bind:agentTicketDelivery={settings.agentTicketDelivery}
	bind:agentTicketNotification={settings.agentTicketNotification}
	bind:agentModel={settings.agentModel}
	bind:agentToolsExpanded={settings.agentToolsExpanded}
	bind:showAgentBar={settings.showAgentBar}
	bind:conflictStrategy={settings.conflictStrategy}
	bind:managerEnabled={settings.managerEnabled}
	bind:managerModel={settings.managerModel}
	isDarkMode={viewState.isDarkMode}
	colorScheme={viewState.colorScheme}
	ontoggleTheme={viewState.toggleTheme}
	onsetColorScheme={(scheme) => viewState.colorScheme = scheme}
/>
	<Header
		bind:searchQuery={viewState.filters.search}
		filterCount={viewState.activeFilterCount}
		ontogglefilters={() => settings.sidebarCollapsed = !settings.sidebarCollapsed}
		bind:viewMode={viewState.viewMode}
		isDarkMode={viewState.isDarkMode}
		{projectName}
		totalIssues={issues.length}
		agentPaneCount={wsPanes.size}
		showAgentPanes={showActivityBar}
		recipes={settings.viewRecipes}
		bind:currentRecipeId={viewState.currentRecipeId}
		hasUnsavedChanges={viewState.hasUnsavedRecipeChanges}
		ontoggleTheme={viewState.toggleTheme}
		onopenKeyboardHelp={() => showKeyboardHelp = true}
		onopenCreatePanel={ops.openCreatePanel}
		onopenSettings={() => showSettings = true}
		onopenPrompts={() => { showSettings = true; showPrompts = true; }}
		onpreviewchange={(previewing) => isFilterPreviewing = previewing}
		oneditProject={() => showSettings = true}
		ontoggleAgentPanes={() => { showActivityBar = !showActivityBar; settings.showAgentBar = showActivityBar; }}
		onsaverecipe={viewState.saveRecipe}
		onapplyrecipe={viewState.applyRecipe}
		ondeleterecipe={viewState.deleteRecipe}
		onrenamerecipe={viewState.renameRecipe}
	/>

	<div class="workspace">
	<FilterSidebar
		filters={viewState.filters}
		{availableLabels}
		{availableAssignees}
		{availableTypes}
		{statusColumns}
		activeCount={viewState.activeFilterCount}
		collapsed={settings.sidebarCollapsed}
		ontogglecollapse={() => settings.sidebarCollapsed = !settings.sidebarCollapsed}
		onclear={viewState.clearFilters}
		queue={queuePanel}
		queueCount={mappedAgentQueue.length + runningAgents.length}
		onexpand={() => settings.sidebarCollapsed = false}
	/>
	<div class="workspace-main">
		<ViewLayout
			{ops}
			{cardDrag}
			{viewState}
			{issues}
			{filteredIssues}
			{orderedTableIssues}
			activeAgents={activeAgentNames}
			{queuedTicketIds}
			{animatingIds}
			{selectedId}
			bind:activeColumnIndex
			bind:tableSelectedIds
			{isFilterPreviewing}
			{projectTransition}
			{worktreeTicketIds}
			{flyingCards}
			{placeholders}
			{shrinkingSourceIds}
			{registerCard}
			{registerPlaceholder}
			{managerSession}
			{wsConnected}
			{currentProjectPath}
			onbulkupdate={bulkUpdateIssues}
			onbulkdelete={bulkDeleteIssues}
		/>
	</div><!-- /.workspace-main -->
	</div><!-- /.workspace -->

<!-- Agent Bar - Pinned to bottom -->
<AgentBar
	{wsConnected}
	{showActivityBar}
	{wsPanes}
	bind:expandedPanes
	bind:newPaneName
	bind:resumePrompt
	bind:showSessionPicker
	bind:sdkSessions
	bind:loadingSdkSessions
	bind:sessionSearchQuery
	{filteredSessions}
	{searchedSessions}
	{paneSizes}
	{panePositions}
	{paneCustomSizes}
	bind:paneMessageInputs
	{draggingPane}
	{resizingPane}
	{loadingStatus}
	agentEnabled={settings.agentEnabled}
	isDarkMode={viewState.isDarkMode}
	agentToolsExpanded={settings.agentToolsExpanded}
	{currentProjectPath}
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
	{managerSession}
	onstartmanager={() => startManager(currentProjectPath)}
	onstartDrag={startDrag}
	onstartResize={startResize}
	oncyclePaneSize={cyclePaneSize}
	onhandleMouseMove={ops.handleMouseMove}
	onhandleMouseUp={ops.handleMouseUp}
	onbasesizechange={(px) => chatBarReserve = px}
/>

<FlyingCardComponent {teleports} />

<InitialLoader status={loadingStatus} visible={!initialLoaded} {projectName} />

{#if switchStatus}
	<div class="switch-status" role="status" aria-live="polite">
		<span class="switch-spinner"></span>
		<span class="switch-text">{switchStatus}</span>
	</div>
{/if}

{#if zen.open}
	<ZenReview
		ids={zen.ids}
		index={zen.index}
		issues={zen.issues}
		onnav={(i) => (zen.index = i)}
		onclose={() => zen.close()}
		onopendetail={(issue) => { zen.close(); ops.openEditPanel(issue); }}
		onquickaction={zen.handleQuickAction}
	/>
{/if}
</div>


{#snippet queuePanel()}
	<QueuePanel
		queue={mappedAgentQueue}
		runningSessions={runningAgents}
		{draggedOverColumn}
		onCancel={ops.cancelQueueItem}
		onReorder={ops.reorderQueue}
		ondragover={(e) => cardDrag.handleDragOver(e, 'queue')}
		ondragleave={(e) => cardDrag.handleDragLeave(e, 'queue')}
		ondrop={(e) => cardDrag.handleDrop(e, 'queue')}
	/>
{/snippet}

<ToastContainer />


<PwaInstallPrompt />

<style>
	.switch-status {
		position: fixed;
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 9998;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.875rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--bg-secondary, #1c1c1f) 82%, transparent);
		border: 1px solid var(--border-subtle);
		box-shadow: var(--shadow-lg);
		backdrop-filter: blur(10px);
		animation: switchStatusIn 160ms ease-out;
	}

	@keyframes switchStatusIn {
		from { opacity: 0; transform: translate(-50%, -8px); }
		to { opacity: 1; transform: translate(-50%, 0); }
	}

	.switch-spinner {
		width: 13px;
		height: 13px;
		border: 2px solid var(--border-default, rgba(255, 255, 255, 0.15));
		border-top-color: var(--accent-primary, #6366f1);
		border-radius: 50%;
		animation: switchSpin 0.7s linear infinite;
	}

	@keyframes switchSpin {
		to { transform: rotate(360deg); }
	}

	.switch-text {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-primary);
		white-space: nowrap;
	}

	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: var(--bg-primary);
		transition: background var(--transition-smooth);
		position: relative;
		overflow: hidden;
	}

	.app.has-chat-bar {
		height: calc(100vh - var(--chat-bar-space, 64px));
	}

	.workspace {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.workspace-main {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	@media (max-width: 768px) {
		.app {
			gap: 0;
		}
	}
</style>
