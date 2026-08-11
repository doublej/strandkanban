<script lang="ts">
	import type { Issue } from '$lib/types';
	import type { Pane } from '$lib/wsStore.svelte';
	import type { PageOps } from '$lib/stores/page-ops.svelte';
	import type { CardDrag } from '$lib/drag-drop/card-drag.svelte';
	import type { ViewState } from '$lib/stores/view-state.svelte';
	import type { BoardAnimation } from '$lib/stores/board-animation.svelte';
	import { columns, sortIssues, getIssueColumn } from '$lib/utils';
	import { settings } from '$lib/stores/settings.svelte';
	import { getManagerVisible } from '$lib/stores/manager.svelte';
	import { sendToPane, interrupt } from '$lib/wsStore.svelte';
	import ColumnNav from './ColumnNav.svelte';
	import KanbanColumn from './KanbanColumn.svelte';
	import ManagerPane from './ManagerPane.svelte';
	import DetailPanelHost from './DetailPanelHost.svelte';

	interface Props {
		ops: PageOps;
		cardDrag: CardDrag;
		viewState: ViewState;
		issues: Issue[];
		filteredIssues: Issue[];
		activeAgents: string[];
		queuedTicketIds: Set<string>;
		animatingIds: Set<string>;
		selectedId: string | null;
		activeColumnIndex: number;
		isFilterPreviewing: boolean;
		projectTransition: 'idle' | 'wipe-out' | 'wipe-in';
		worktreeTicketIds: Set<string>;
		anim: BoardAnimation;
		managerSession: Pane | null;
		wsConnected: boolean;
		currentProjectPath: string;
	}

	let {
		ops,
		cardDrag,
		viewState,
		issues,
		filteredIssues,
		activeAgents,
		queuedTicketIds,
		animatingIds,
		selectedId,
		activeColumnIndex = $bindable(),
		isFilterPreviewing,
		projectTransition,
		worktreeTicketIds,
		anim,
		managerSession,
		wsConnected,
		currentProjectPath
	}: Props = $props();

	function toggleSortMenu(columnKey: string, e: MouseEvent) {
		e.stopPropagation();
		ops.sortMenuOpen = ops.sortMenuOpen === columnKey ? null : columnKey;
	}
</script>

<ColumnNav
	{columns}
	bind:activeColumnIndex
	{issues}
	{filteredIssues}
	hasActiveFilters={viewState.hasActiveFilters}
	showColumnCounts={settings.showColumnCounts}
/>

<div class="app-body">
<div class="main-content" class:wipe-out={projectTransition === 'wipe-out'} class:wipe-in={projectTransition === 'wipe-in'}>
	<main class="board" ontouchstart={cardDrag.handleTouchStart} ontouchend={cardDrag.handleTouchEnd}>
		{#each columns as column, i}
			{#if i === 0 && ops.isCreating}
				<DetailPanelHost {ops} {cardDrag} {issues} {activeAgents} />
			{/if}
			{#if i === columns.length - 1 && ops.editingIssue && ops.panelColumnIndex === i}
				<DetailPanelHost {ops} {cardDrag} {issues} {activeAgents} />
			{/if}
			{@const rawColumnIssues = issues.filter((x) => getIssueColumn(x).key === column.key && !queuedTicketIds.has(x.id))}
			{@const allColumnIssues = sortIssues(rawColumnIssues, viewState.columnSortBy[column.key] ?? settings.defaultColumnSort)}
			{@const matchingCount = allColumnIssues.filter(viewState.matchesFilters).length}
			{@const isCollapsed = settings.collapsedColumns.has(column.key)}
			{@const currentSort = viewState.columnSortBy[column.key]}
			<KanbanColumn
				{column}
				columnIndex={i}
				{allColumnIssues}
				{matchingCount}
				{isCollapsed}
				{currentSort}
				sortMenuOpen={ops.sortMenuOpen}
				{selectedId}
				editingIssue={ops.editingIssue}
				draggedId={cardDrag.draggedId}
				draggedOverColumn={cardDrag.draggedOverColumn}
				dropTargetColumn={cardDrag.dropTargetColumn}
				dropIndicatorIndex={cardDrag.dropIndicatorIndex}
				{animatingIds}
				hasActiveFilters={viewState.hasActiveFilters}
				{isFilterPreviewing}
				flyingCards={anim.flyingCards}
				placeholders={anim.placeholders}
				shrinkingSourceIds={anim.shrinkingSourceIds}
				{worktreeTicketIds}
				{activeColumnIndex}
				showColumnCounts={settings.showColumnCounts}
				registerCard={anim.registerCard}
				registerPlaceholder={anim.registerPlaceholder}
				issueMatchesFilters={viewState.matchesFilters}
				ondragover={(e) => cardDrag.handleDragOver(e, column.key)}
				ondragleave={(e) => cardDrag.handleDragLeave(e, column.key)}
				ondrop={(e) => cardDrag.handleDrop(e, column.key)}
				oncollapseclick={(key) => settings.toggleColumnCollapse(key)}
				ontogglecollapse={(e, key) => { e.stopPropagation(); settings.toggleColumnCollapse(key); }}
				ontogglesortmenu={(key, e) => toggleSortMenu(key, e)}
				onsetcolumnsort={(key, sortBy) => { viewState.setColumnSort(key, sortBy); ops.sortMenuOpen = null; }}
				oncardclick={(issue) => ops.openEditPanel(issue)}
				oncarddragstart={(e, id) => cardDrag.handleDragStart(e, id)}
				oncarddragend={cardDrag.handleDragEnd}
				oncardcontextmenu={(e, issue) => ops.openContextMenu(e, issue)}
				oncopyid={(id, text) => ops.copyToClipboard(id, text)}
				showAddButton={i === 0}
				onaddclick={ops.openCreatePanel}
			/>
			{#if ops.editingIssue && ops.panelColumnIndex === i && i !== columns.length - 1}
				<DetailPanelHost {ops} {cardDrag} {issues} {activeAgents} />
			{/if}
		{/each}
	</main>
	</div>
	{#if getManagerVisible() && managerSession}
		{#key currentProjectPath}
			<ManagerPane
				session={managerSession}
				onSendMessage={(name, msg) => sendToPane(name, msg, currentProjectPath)}
				onInterrupt={interrupt}
				disabled={!wsConnected}
			/>
		{/key}
	{/if}
</div>

<style>
	.app-body {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.main-content {
		display: flex;
		flex: 1;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	.main-content.wipe-out {
		animation: wipeUp 350ms ease-in forwards;
	}

	.main-content.wipe-in {
		animation: wipeDown 350ms ease-out forwards;
	}

	.board {
		display: flex;
		gap: 1rem;
		padding: 1.25rem;
		flex: 1 1 0;
		min-height: 0;
		overflow-x: auto;
		overflow-y: hidden;
		transition: margin-right var(--transition-smooth);
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.board::-webkit-scrollbar {
		display: none;
	}

	@media (max-width: 768px) {
		.main-content {
			flex-direction: column;
		}

		.board {
			flex-direction: column;
			padding: var(--mobile-padding);
			padding-left: max(var(--mobile-padding), env(safe-area-inset-left));
			padding-right: max(var(--mobile-padding), env(safe-area-inset-right));
			gap: 0.25rem;
			overflow-y: auto;
		}
	}
</style>
