<script lang="ts">
	import { browser } from '$app/environment';
	import { untrack } from 'svelte';
	import { setCurrentProject } from '$lib/project';
	import type { Issue } from '$lib/types';
	import { getColumnsWithCustom, sortIssuesBy } from '$lib/utils';
	import Header from '$lib/components/Header.svelte';
	import ZenReview from '$lib/components/ZenReview.svelte';
	import FlyingCardComponent from '$lib/components/FlyingCard.svelte';
	import InitialLoader from '$lib/components/InitialLoader.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import QueuePanel from '$lib/components/QueuePanel.svelte';
	import PwaInstallPrompt from '$lib/components/PwaInstallPrompt.svelte';
	import FilterSidebar from '$lib/components/FilterSidebar.svelte';
	import ViewLayout from '$lib/components/ViewLayout.svelte';
	import AppDialogs from '$lib/components/AppDialogs.svelte';
	import AgentBarHost from '$lib/components/AgentBarHost.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { notificationStore } from '$lib/notifications/notification-store.svelte';
	import { createKeyboardNav } from '$lib/keyboard/kanban-nav';
	import { createIssueStore } from '$lib/stores/issue-store.svelte';
	import { createCardDrag } from '$lib/drag-drop/card-drag.svelte';
	import { createPageOps } from '$lib/stores/page-ops.svelte';
	import { createBoardAnimation } from '$lib/stores/board-animation.svelte';
	import { createViewState } from '$lib/stores/view-state.svelte';
	import { createAgentPanes } from '$lib/stores/agent-panes.svelte';
	import { createProjectSession } from '$lib/stores/project-session.svelte';
	import { createZen } from '$lib/stores/zen.svelte';
	import { getQueueItems, getQueuedTicketIds } from '$lib/stores/queue.svelte';

	let { data } = $props();

	// --- UI State (page-only) ---
	let isFilterPreviewing = $state(false);
	let selectedId = $state<string | null>(null);
	let activeColumnIndex = $state(0);
	let tableSelectedIds = $state<string[]>([]);
	let showKeyboardHelp = $state(false);
	let showHotkeys = $state(false);
	let showSettings = $state(false);
	let showWizard = $state(browser && !localStorage.getItem('beads-wizard-complete'));
	let showPrompts = $state(false);
	let showProjectSwitcher = $state(false);

	// --- Seed frontend project context before any effect fires ---
	// data.cwd already reflects any ?project= param (resolveProjectCwd on the server),
	// so appendProjectParam works on the very first client request — no CWD_MISSING
	// 400s, no SSE-reconnect stall on cold load.
	if (browser && data.cwd) {
		setCurrentProject(data.cwd);
	}

	// `session` is created further down (it needs issueStore + agentPanes), but on the
	// SERVER `$derived`/`$derived.by` run eagerly at store-creation time — agent-panes'
	// `managerSession` calls this getter inside `createAgentPanes`, hitting `session` in
	// its TDZ and 500ing every SSR render. The client never saw it because `$derived` is
	// lazy there. Hold the ref in a `let` and fall back to the server-resolved cwd, which
	// is exactly what `session.currentProjectPath` initializes to.
	let sessionRef: ReturnType<typeof createProjectSession> | undefined;
	const getCurrentProjectPath = () => sessionRef?.currentProjectPath ?? data.cwd ?? '';

	// --- View preferences (filters, view mode, recipes, theme) ---
	const viewState = createViewState({ getCurrentProjectPath });

	// --- Agent panes (WS snapshot + per-pane UI state) ---
	const agentPanes = createAgentPanes({ getCurrentProjectPath });

	// --- Card teleport animation ---
	const boardAnimation = createBoardAnimation();

	// --- Issue Store ---
	const issueStore = createIssueStore({
		onNewIssue: () => {}, // Notifications now handled by event system
		onStatusChange: () => {}, // Notifications now handled by event system
		animation: boardAnimation,
		notifyTicket: (id, message, type, context) => ops.notifyTicket(id, message, type, context),
		onEditingIssueClosedExternally: () => { ops.issueClosedExternally = true; },
		getEditingIssue: () => ops.editingIssue,
		getIsCreating: () => ops.isCreating
	}, data.issues ?? []);

	let issues = $derived(issueStore.issues);
	let statusColumns = $derived(getColumnsWithCustom(issues));

	// --- Page Operations (detail panel, deps, context menu, agent ops) ---
	const ops = createPageOps({
		issueStore,
		getIssues: () => issues,
		getWsPanes: () => agentPanes.wsPanes,
		getCurrentProjectPath,
		getSelectedId: () => selectedId,
		setSelectedId: (id) => { selectedId = id; },
		getExpandedPanes: () => agentPanes.expandedPanes,
		setExpandedPanes: (v) => { agentPanes.expandedPanes = v; },
	});

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

	// --- Project session (current project + SSE lifecycle) ---
	const session = createProjectSession({
		initialCwd: data.cwd ?? '',
		connectSse: () => issueStore.connectSSE(),
		closeSse: () => issueStore.closeSse(),
		setIssues: (list) => issueStore.setIssues(list),
		getWsConnected: () => agentPanes.wsConnected,
		onSwitched: () => {
			issueStore.initialLoaded = true;
			selectedId = null;
			tableSelectedIds = [];
			ops.editingIssue = null;
			ops.isCreating = false;
		}
	});
	sessionRef = session;

	let serverQueue = $derived(getQueueItems());
	let queuedTicketIds = $derived(getQueuedTicketIds());
	let mappedAgentQueue = $derived(serverQueue.filter(item => item.cwd === session.currentProjectPath).map(item => ({
		ticketId: item.ticketId,
		title: item.title,
		description: item.description,
		agentName: item.agentName,
		cwd: item.cwd
	})));

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
		getProjectCount: () => session.projects.length,
		createIssue: ops.createIssue,
		openCreatePanel: ops.openCreatePanel,
		openEditPanel: (issue) => { tableSelectedIds = []; ops.openEditPanel(issue); },
		deleteIssue: ops.deleteIssue,
		toggleTheme: viewState.toggleTheme,
		closePanel: ops.closePanel,
		openZenReview: () => zen.openReview()
	});
	const { handleKeydown, handleKeyup, handleWindowBlur } = keyboardNav;

	$effect(() => {
		untrack(() => notificationStore.init());
	});

	function handlePopState(e: PopStateEvent) {
		if (session.handleProjectPopState()) return;
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

<div class="app scheme-{viewState.colorScheme}" class:light={!viewState.isDarkMode} class:panel-open={ops.panelOpen} class:show-hotkeys={showHotkeys || settings.alwaysShowHotkeys} class:has-chat-bar={agentPanes.wsConnected && agentPanes.showActivityBar} style="--project-color: {session.projectColor}; --chat-bar-space: {agentPanes.chatBarReserve}px">

<AppDialogs
	{ops}
	{viewState}
	{session}
	bind:showProjectSwitcher
	bind:showKeyboardHelp
	bind:showWizard
	bind:showSettings
	bind:showPrompts
/>
	<Header
		bind:searchQuery={viewState.filters.search}
		filterCount={viewState.activeFilterCount}
		ontogglefilters={() => settings.sidebarCollapsed = !settings.sidebarCollapsed}
		bind:viewMode={viewState.viewMode}
		isDarkMode={viewState.isDarkMode}
		projectName={session.projectName}
		totalIssues={issues.length}
		agentPaneCount={agentPanes.wsPanes.size}
		showAgentPanes={agentPanes.showActivityBar}
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
		ontoggleAgentPanes={agentPanes.toggleActivityBar}
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
		queueCount={mappedAgentQueue.length + agentPanes.runningAgents.length}
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
			activeAgents={agentPanes.activeAgentNames}
			{queuedTicketIds}
			animatingIds={issueStore.animatingIds}
			{selectedId}
			bind:activeColumnIndex
			bind:tableSelectedIds
			{isFilterPreviewing}
			projectTransition={session.projectTransition}
			worktreeTicketIds={agentPanes.worktreeTicketIds}
			anim={boardAnimation}
			managerSession={agentPanes.managerSession}
			wsConnected={agentPanes.wsConnected}
			currentProjectPath={session.currentProjectPath}
			onbulkupdate={bulkUpdateIssues}
			onbulkdelete={bulkDeleteIssues}
		/>
	</div><!-- /.workspace-main -->
	</div><!-- /.workspace -->

<!-- Agent Bar - Pinned to bottom -->
<AgentBarHost
	{agentPanes}
	{ops}
	{session}
	loadingStatus={issueStore.loadingStatus}
	isDarkMode={viewState.isDarkMode}
/>

<FlyingCardComponent teleports={boardAnimation.teleports} />

<InitialLoader status={issueStore.loadingStatus} visible={!issueStore.initialLoaded} projectName={session.projectName} />

{#if session.switchStatus}
	<div class="switch-status" role="status" aria-live="polite">
		<span class="switch-spinner"></span>
		<span class="switch-text">{session.switchStatus}</span>
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
		runningSessions={agentPanes.runningAgents}
		draggedOverColumn={cardDrag.draggedOverColumn}
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
